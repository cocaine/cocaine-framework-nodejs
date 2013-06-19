
var mp = require("msgpack")
var __assert = require("assert")

var util = require("./util")

var TCP = process.binding("tcp_wrap").TCP

var protocol = require("./protocol")
var RPC = protocol.RPC
var _RPC = protocol._RPC

function Req(handle,cb){
  this._handle = handle
  this.oncomplete = cb
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
    address:"0.0.0.0",
    port:12345
  },
  _sock_addr:{
    address:"127.0.0.1",
    port:12345
  },

  _onMeta:function(meta){
    this._listenHandle.push(this)
  },

  push:function(chunk){
    __assert(!this._read_ended)

    // decode metadata in first chunk
    if(!this._meta){
      this._meta = {} // mp.unpack(chunk)
      this._onMeta && this._onMeta(this._meta)
      //return
    }
    
    if(this._closing){
      return
    }

    if(chunk === null){
      this._read_ended = true
    }
    
    if(this._paused){
      this._read_chunks.push(chunk)
    } else {
      if(!this._read_ended){
        this.onread(chunk,0,chunk.length)
      } else {
        process._errno = "EOF"
        this.onread()
      }
    }
  },

  choke:function(){
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
        process._errno = "EOF"
        this.onread()
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
  writeBuffer:function(chunk){
    __assert(!this._closing)
    this._worker._handle.send(mp.pack([_RPC.chunk,this._id,[chunk]]))
    var req = new WriteReq(this,chunk)
    this._write_reqs.push(req)
    process.nextTick(this._hdl.afterWrite)
    return req
  },
  shutdown:function(){
    __assert(!this._closing &&
             !this._write_ended && !this._write_done)
    this._write_ended = true
    var req = this._shutdown_req = new Req(this)
    process.nextTick(this._hdl.afterShutdown)
    return req
  },
  close:function(cb){
    __assert(!this._closing)
    this._closing = true
    this._worker._handle.send(mp.pack([_RPC.choke,this._id,[]]))
    if(typeof cb === "function"){
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
  writeString:function(s,encoding){
    __assert(typeof s === "string"
             && typeof s === "string")
    return this.writeBuffer(new Buffer(s,encoding))
  },
  writeAsciiString:function(s){
    return this.writeString(s,"ascii")
  },
  writeUtf8String:function(s){
    return this.writeString(s,"utf8")
  },
  writeUcs2String:function(s){
    return this.writeString(s,"ucs2")
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
  this._id = connection_event
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
        this.onconnection(sh)
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
  throw new Error("method not implemented")
}



module.exports = {
  ListenHandle:ListenHandle,
  StreamHandle:StreamHandle
}



