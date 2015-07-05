
var net = require('net')

var mp = require('msgpack-bin')

var __assert = require('assert')

var debug = require('debug')('co:client:channel')
var inspect = require('util').inspect

var errno = require('../errno').errno
var util = require('../util')

var trace = 0

var fail = {v:'fail'}

function notImplemented(){
  throw new Error('method not implemented')
}

function unpackMessage(buf, binary){
  if(buf.length === 0){
    return 
  }

  if(!((buf[0] & 0xF0) === 0x90)){
    return fail
  }

  var m = mp.unpack(buf, binary)
  debug('mp.unpack.bytes_remaining', mp.unpack.bytes_remaining)
  if(m === null){
    return m
  }
  unpackMessage.bytesParsed = buf.length - mp.unpack.bytes_remaining
  return m
}


function Channel(host, port, binary){
  debug('creating channel')
  this.owner = null
  this._socket = null
  this._host = null
  this._port = null
  this._socketPath = null
  this._inBuffer = null
  this._hdl = {}
  ;['on_socket_error', 'on_connect',
    'on_message'].some(function(event){
      this[event] = notImplemented
    }, this)
  util.bindHandlers(this.hdl, this._hdl, this)
  this._parseArguments.apply(this, arguments)
  this.connect()
}

Channel.prototype = {
  connect: function(){
    debug('connecting channel')
    __assert(!this._socket, '!this._socket')
    this._makeSocket()
    __assert(this._socketPath || this._host && this._port,
             'this._socketPath || this._host && this._port')
    if(this._socketPath){
      debug('connecting channel, path:', this._socketPath)
      this._socket.connect(this._socketPath)
    } else if(this._host){
      debug('connecting channel, [host,port]:', [this._host, this._port])
      this._socket.connect(this._port, this._host)
    }
  },
  send: function(buf){
    __assert(this._socket && Buffer.isBuffer(buf), 'this._socket && Buffer.isBuffer(buf)')
    debug('sending', buf)
    this._socket.write(buf)
  },

  close: function(){
    if(this._socket){
      this._socket.end()
      this._destroySocket()
    }
  },

  _parseArguments: function(){
    if(typeof arguments[arguments.length-1] === 'boolean'){
      var length = arguments.length-1
      this._binary = arguments[arguments.length-1]
    } else {
      var length = arguments.length
    }
    if(length === 1){
      var path = arguments[0]
      __assert(typeof path === 'string',
               "typeof path === 'string'")
      this._socketPath = path
    } else if (length === 2){
      var host = arguments[0]
      var port = arguments[1]
      __assert(typeof host === 'string' && typeof port === 'number',
               "typeof host === 'string' && typeof port === 'number'")
      this._host = host
      this._port = port
    } else {
      throw new Error('bad match: '+JSON.stringify(arguments))
    }
  },

  _destroySocket: function(){
    if(this._socket){
      var s = this._socket
      this._socket = null
      s.removeListener('connect', this._hdl.connect)
      s.removeListener('error', this._hdl.error)
      s.removeListener('close', this._hdl.close)
      s.removeListener('data', this._hdl.data)
      s.destroy()
    }
  },

  _makeSocket: function(){
    __assert(!this._socket, '!this._socket')
    this._socket = new net.Socket({allowHalfOpen: true})
    this._socket.on('connect', this._hdl.connect)
    this._socket.on('error', this._hdl.error)
  },
  
  hdl:{
    connect: function(){
      debug('channel.hdl.connect')
      this._socket.removeListener('connect', this._hdl.connect)
      this._socket.on('data', this._hdl.data)
      this._socket.on('end', this._hdl.end)
      this.on_connect()
    },

    end: function(){
      debug('channel.hdl.end')
      if(!this._errorFired){
        this._errorFired = true
        this.on_socket_error(errno.ESHUTDOWN)
      }
    },

    close: function(){
      debug('channel.hdl.close')
      if(!this._errorFired){
        this._errorFired = true
        this.on_socket_error(errno.EPIPE)
      }
      this._destroySocket()
    },
    
    error: function(err){
      debug('channel.hdl.error', err)
      if(!this._errorFired){
        var errno0 = errno[err.code] || errno.EBADF
        this._errorFired = true
        this.on_socket_error(errno0)
        this._destroySocket()
      }
    },
    
    message: function(m){
      debug('channel.hdl.message', m)
      if(!(typeof m === 'object' && typeof m.length === 'number' && m.length <= 3)){
        debug('message is not a tuple', m)
        this._hdl.error({code: 'EBADMSG'})
        return false
      }
      var  sid = m[0], mid = m[1], args = m[2]
      if(!(typeof mid === 'number'
           && typeof sid === 'number'
           && (typeof args === 'object' && typeof args.length === 'number'))){
        debug('bad message tuple')
        this._hdl.error({code: 'EBADMSG'})
        return false
      }

      this.on_message(m)
      
      return true
    },

    data: function(buf){
      debug('channel got data', buf)
      __assert(Buffer.isBuffer(buf), 'Buffer.isBuffer(buf)')
      
      if(this._inBuffer){
        debug('previous data present')
        this._inBuffer = Buffer.concat([this._inBuffer, buf])
      } else {
        debug('no previous data present')
        this._inBuffer = buf
      }
      var m
      while(true){
        m = unpackMessage(this._inBuffer, this._binary)
        debug('unpacked message', inspect(m, {depth:null}))
        if(!m){
          break
        }

        debug('channel got message', m)

        if(m === fail){
          debug('bad message framing')
          //we close it just as if it is of some unexpected form
          //this.close()
        } else {

          var remaining = this._inBuffer.length - unpackMessage.bytesParsed
          debug('unpackMessage.bytesParsed, remaining', unpackMessage.bytesParsed, remaining)
          
        }

        // this is a bit cryptic.
        // what we do here is, if the message is of some very unexpected form,
        // don't do anything more. Error handling is done elsewhere,
        // here we have to just bail out of this handler
        if(!this._hdl.message(m)){
          return
        }
        
        if(0 < remaining){
          debug('remaining buffer', this._inBuffer.slice(unpackMessage.bytesParsed))
          this._inBuffer = this._inBuffer.slice(this._inBuffer.length - remaining)
        } else {
          this._inBuffer = null
          return 
        }
      }
    }
  }
  
}

module.exports.Channel = Channel

