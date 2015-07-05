
var mp = require('msgpack-bin')
var __assert = require('assert')

//var jp = require('@nojs/jampack')

var debug = require('debug')('co:handles')

var util = require('../util')

var TCP = process.binding('tcp_wrap').TCP

var protocol = require('../protocol')
var RPC = protocol.RPC

var uv = process.binding('uv')

var trace = 0

function Req(handle,cb){
  this._handle = handle
  this.oncomplete = cb
}

function decodeRequest(req){
  // [method, url, httpver, headers, body]
  req[0] = req[0].toString('ascii')
  req[1] = req[1].toString('ascii')
  req[2] = req[2].toString('ascii')

  var hh = req[3]
  for(var hi = 0; hi < hh.length; hi++){
    var kv = hh[hi]
    kv[0] = kv[0].toString('ascii')
    kv[1] = kv[1].toString('ascii')
  }
  // req[4] = req[4]
  
  return req
}

// var requestParser = jp([
//   jp.string, //method
//   jp.string, //uri
//   jp.string, //httpver
//   jp.list([  //headers
//     jp.string,
//     jp.string]),
//   jp.binary //binary-body
// ])

function parseHttpVersion(httpVer){
  if(httpVer[0] === 'H'){
    __assert(httpVer[1] === 'T'
             && httpVer[2] === 'T'
             && httpVer[3] === 'P'
             && httpVer[4] === '/',
             'HTTP/')
    httpVer = httpVer.slice(5)
  }
  
  var Mm = httpVer.split('.')
  __assert(Mm.length === 2)

  var M = parseInt(Mm[0])
  var m = parseInt(Mm[1])

  __assert(!isNaN(M) && !isNaN(m), '!isNaN(M) && !isNaN(m)')

  return [M,m]
}

function bakeRequest(chunk){
  // ('PUT', '/', 'HTTP/1.1',
  //  [('adsfasdf', 'qewrqwer'),
  //   ('Content-Length', '11'),
  //   ('Accept', '*/*'),
  //   ('User-Agent', 'curl/7.29.0'),
  //   ('Host', 'localhost:8080'),
  //   ('Cookie', 'adsfasdf=qewrqwer'),
  //   ('Content-Type', 'application/x-www-form-urlencoded')], 'binary-body')

  // which also could be (note the other version format):
  // ('PUT', '/', '1.1',
  //  [('adsfasdf', 'qewrqwer'),
  //   ('Content-Length', '11'),
  //   ('Accept', '*/*'),
  //   ('User-Agent', 'curl/7.29.0'),
  //   ('Host', 'localhost:8080'),
  //   ('Cookie', 'adsfasdf=qewrqwer'),
  //   ('Content-Type', 'application/x-www-form-urlencoded')], 'binary-body')

  __assert(Buffer.isBuffer(chunk),'parsing request not from a buffer')
  var rq = mp.unpack(chunk, true)
  rq = decodeRequest(rq)

  var method = rq[0]
  var uri = rq[1]
  var httpVer = rq[2]
  var hh = rq[3].map(function(kv){
    return kv[0]+': '+kv[1]
  })
  var Mm = parseHttpVersion(httpVer)
  hh.unshift(method+' '+uri+' HTTP/'+Mm[0]+'.'+Mm[1])
  hh.push('\r\n')
  var requestBuf = Buffer(hh.join('\r\n'))
  if(rq[4].length){
    var body = rq[4]
    requestBuf = Buffer.concat([requestBuf,body])
    // TODO: we could return [requestBuf,body
  }
  trace && console.log('baked request: ================================================================')
  trace && console.log(requestBuf.toString('ascii'))
  return requestBuf
}

Req.prototype = {
  done:function(){
    this.oncomplete(0,this._handle,this)
  },
  fail:function(status){
    this.oncomplete(status,this._handle,this)
  }
}

function WriteReq(handle,chunk,cb){
  Req.call(this,handle,cb)
  this.buffer = chunk
  this.bytes = chunk.length
}

WriteReq.prototype.__proto__ = Req.prototype

function StreamHandle(id,worker,listenHandle){
  this._id = id
  this._worker = worker
  this._listenHandle = listenHandle
  this._meta = null

  this._first_outgoing = null
  
  this._paused = true
  
  this._read_ended = false
  this._read_done = false
  this._read_chunks = []
  
  this._write_ended = false
  this._write_done = false
  this._write_reqs = []
  this._shutdown_req = null
  
  this._closing = false
  this._close_done = false

  this.onread = null
  
  this._hdl = {}
  util.bindHandlers(this.hdl,this._hdl,this)
}

StreamHandle.prototype = {
  writeQueueSize:0,
  _peer_addr:{
    address:'0.0.0.0',
    port:12345
  },
  _sock_addr:{
    address:'127.0.0.1',
    port:12345
  },

  push:function(chunk){
    __assert(!this._read_ended)

    if(!this._connected){
      debug('!this._connected')
      
      if(this._listenHandle){

        debug('this._listenHandle.push()')
        
        this._listenHandle.push(this)
        this._connected = true
      }
    }
    
    if(this._closing){
      debug('this._closing')
      return
    }

    if(chunk === null){
      debug('chunk === null, so set this._read_ended = true')
      this._read_ended = true
    }

    // HACK: transform the only request chunk to usual http request
    if(chunk){
      debug('// HACK: transform the only request chunk to usual http request')
      __assert(!this._meta,'got two request chunks in http request, which is absolutely not in 0.10 cocaine fashion')
      this._meta = chunk
      chunk = bakeRequest(chunk)
      debug('and request is ----\n%s\n--------', chunk.toString())
    }

    if(this._paused){
      debug('this._paused, so this._read_chunks.push(chunk)')
      this._read_chunks.push(chunk)
    } else {
      if(!this._read_ended){
        debug('!this._read_ended, so this.onread(chunk,0,chunk.length)', chunk,0,chunk.length)
        this.onread(chunk.length, chunk)
      } else {
        debug('this._pushClose()')
        this._pushClose()
      }
    }
  },

  _pushClose:function(){
    __assert(!this._read_done)
    process._errno = 'EOF'
    global.errno = 'EOF' // node 0.8 compatibility
    this.onread(uv.UV_EOF)
    this._read_done = true
  },

  pushChunk:function(chunk){
    __assert(Buffer.isBuffer(chunk))
    debug('pushChunk', chunk)
    this.push(chunk)
  },

  pushChoke:function(){
    this.push(null)
  },
  
  pushError:function(errno){
    process._errno = errno
    this.onread()
  },

  _emitReadChunks:function(){
    while(!this._paused && this._read_chunks.length){
      var c = this._read_chunks.shift()
      if(c === null){
        this._pushClose()
      } else {
        this.onread(c,0,c.length)
      }
    }
  },

  readStart:function(){
    __assert(!this._closing)
    if(this._paused){
      this._paused = false
      this._emitReadChunks()
    }
  },
  readStop:function(){
    __assert(!this.closing)
    this._paused = true
  },
  writeBuffer:function(req, chunk){
    __assert(!this._closing)

    // HACK: pack all but first outgoing chunks
    // HACK: prepare to remove the above hack: first outgoing is packed
    //   elsewhere, and we don't pack any following chunks 
    if(!this._first_outgoing){
      this._first_outgoing = chunk
    } else {
      // HACK: don't pack. see note above.
      //chunk = mp.pack(chunk)
    }
    
    //this._worker._handle.send(mp.pack([this._id, RPC.chunk, [chunk]]))
    this._worker._handle.send(mp.pack([this._id, 0, [chunk]]))
    //var req = new WriteReq(this,chunk)
    this._write_reqs.push(req)
    process.nextTick(this._hdl.afterWrite)
    return 0
    //return req
  },
  shutdown:function(){
    __assert(!this._closing &&
             !this._write_ended && !this._write_done)
    this._write_ended = true

    this._meta && (this._meta = null)
    this._first_outgoing && (this._first_outgoing = null)

    var req = this._shutdown_req = new Req(this)
    process.nextTick(this._hdl.afterShutdown)
    return req
  },
  close:function(cb){
    __assert(!this._closing)
    this._closing = true

    this._meta && (this._meta = null)
    this._first_outgoing && (this._first_outgoing = null)

    //this._worker._handle.send(mp.pack([this._id, RPC.choke, []]))
    this._worker._handle.send(mp.pack([this._id, 2, []]))
    if(typeof cb === 'function'){
      this.close = cb // the exact behavior of node::HandleWrap::Close
    }
    process.nextTick(this._hdl.afterClose)
  },
  ref:function(){
    this._worker.ref()
  },
  unref:function(){
    this._worker.unref()
  },
  writeString:function(req, s, encoding){
    console.log('write String arguments', arguments)
    __assert(typeof s === 'string'
             && typeof s === 'string')
    return this.writeBuffer(req, new Buffer(s, encoding))
  },
  writeAsciiString:function(req, s){
    return this.writeString(req, s, 'ascii')
  },
  writeUtf8String:function(req, s){
    return this.writeString(req, s, 'utf8')
  },
  writeUcs2String:function(req, s){
    return this.writeString(req, s, 'ucs2')
  },
  writeBinaryString:function(req, s){
    return this.writeString(req, s, 'binary')
  },
  getpeername:function(){
    return this._peer_addr
  },
  _setpeername:function(addr){
    this._peer_addr = addr
  },
  getsockname:function(){
    return this._sock_addr
  },

  hdl:{
    afterShutdown:function(){
      __assert(this._write_ended && !this._write_done
               && this._shutdown_req)
      if(!this._closing){
        this._write_done = true
        var req = this._shutdown_req
        this._shutdown_req = null
        req.done()
      }
    },
    afterWrite:function(){
      __assert(!this._write_done)
      if(!this._closing){
        var req
        while(req = this._write_reqs.shift()){
          req.done()
        }
      }
    },
    afterClose:function(){
      __assert(this._closing)
      if(!this._close_done){
        this._close_done = true
        if(this.close !== StreamHandle.prototype.close){
          this.close()
        }
      }
    }
  }
  
  
}


function ListenHandle(connection_event, worker){
  __assert(typeof connection_event === 'string' || typeof connection_event === 'number',
           "typeof connection_event === 'string' || typeof connection_event === 'number'")
  this._id = connection_event.toString()
  this._worker = worker
  this._listening = false
  this._closed = false
  this._pending_connections = []
  this.onconnection = null
}

ListenHandle.prototype = {
  __proto__:TCP.prototype,
  createStreamHandle:function(sid,event){
    __assert(event === this._id)
    return new StreamHandle(sid,this._worker,this)
  },
  push:function(sh){
    if(!this._closed){
      if(this._listening){
        this.onconnection(null, sh)
      } else {
        this._pending_connections.push(sh)
      }
    }
  },
  ref:function(){
    __assert(this._worker)
    this._worker.ref()
  },
  unref:function(){
    __assert(this._worker)
    this._worker.unref()
  },
  listen:function(){
    if(!this._listening){
      this._listening = true
      this._worker.listen()
      this._emitPendingConnections()
    }
  },
  close:function(){
    if(!this._closed){
      this._closed = true
      this._worker.removeListenHandle(this)
    }
  },
  _emitPendingConnections:function(){
    var sh
    while(!this._closed && (sh = this._pending_connections.shift())){
      this.onconnection(sh)
    }
  },
  readStart:notImplemented,
  readStop:notImplemented,
  shutdown:notImplemented,
  writeBuffer:notImplemented,
  writeAsciiString:notImplemented,
  writeUtf8String:notImplemented,
  writeUsc2String:notImplemented,
  writev:notImplemented,
  open:notImplemented,
  bind:notImplemented,
  connect:notImplemented,
  setNoDelay:notImplemented,
  setKeepAlive:notImplemented
}


function notImplemented(){
  throw new Error('method not implemented')
}



module.exports = {
  ListenHandle:ListenHandle,
  StreamHandle:StreamHandle
}



