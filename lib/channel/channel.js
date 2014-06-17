
var __assert = require('assert')
var net = require('net')
var mp = require('msgpack')


var errno = require('../errno').errno
var util = require('../util')


var _mp = require('./mp')
var unpackMessage = _mp.unpackMessage
var _mpFail = _mp.fail

var RPC = require('../protocol').RPC

var trace = 0

function notImplemented(){
  throw new Error('method not implemented')
}

function Channel(host, port){
  trace && console.log('creating channel')
  this.owner = null
  this._socket = null
  this._host = null
  this._port = null
  this._socketPath = null
  this._inBuffer = null
  this._hdl = {}
  ;['on_socket_error', 'on_connect',
    'on_invoke', 'on_chunk', 'on_choke', 'on_error',
    'on_heartbeat', 'on_terminate'].some(function(event){
      this[event] = notImplemented
    }, this)
  util.bindHandlers(this.hdl, this._hdl, this)
  this._parseArguments.apply(this, arguments)
  this.connect()
}

Channel.prototype = {
  connect: function(){
    trace && console.log('connecting channel')
    __assert(!this._socket, '!this._socket')
    this._makeSocket()
    __assert(this._socketPath || this._host && this._port,
             'this._socketPath || this._host && this._port')
    if(this._socketPath){
      trace && console.log('connecting channel, path:', this._socketPath)
      this._socket.connect(this._socketPath)
    } else if(this._host){
      trace && console.log('connecting channel, [host,port]:', [this._host, this._port])
      this._socket.connect(this._port, this._host)
    }
  },

  send: function(buf){
    __assert(this._socket && Buffer.isBuffer(buf), 'this._socket && Buffer.isBuffer(buf)')
    this._socket.write(buf)
  },

  sendTerminate: function(sid, code, message){
    __assert(arguments.length === 3
             && typeof sid === 'number'
             && typeof code === 'number'
             && typeof message === 'string',
             "arguments.length === 3 && typeof sid === 'number' && typeof code === 'number' && typeof message === 'string'")
    this._socket.send(mp.pack([protocol.RPC.terminate, sid, [code, message]]))
  },
  
  close: function(){
    if(this._socket){
      this._socket.end()
      this._destroySocket()
    }
  },

  _parseArguments: function(){
    if(arguments.length === 1){
      var path = arguments[0]
      __assert(typeof path === 'string',
               "typeof path === 'string'")
      this._socketPath = path
    } else if (arguments.length === 2){
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
      this._socket.removeListener('connect', this._hdl.connect)
      this._socket.removeListener('error', this._hdl.error)
      this._socket.removeListener('close', this._hdl.close)
      this._socket.removeListener('data', this._hdl.data)
      this._socket.destroy()
      this._socket = null
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
      this._socket.removeListener('connect', this._hdl.connect)
      this._socket.on('data', this._hdl.data)
      this.on_connect()
    },

    close: function(err){
      if(!this._errorFired){
        this._errorFired = true
        this.on_socket_error(errno.EBADF)
      }
      this._destroySocket()
    },
    
    error: function(err){
      var errno0 = errno[err.errno]
      this._errorFired = true
      this.on_socket_error(errno0)
      this._destroySocket()
    },
    
    message: function(m){
      switch(m[0]){

        case RPC.heartbeat: {
          this.on_heartbeat()
          break
        }
        
        case RPC.invoke: {
          var sid = m[1], event = m[2][0]
          if(!(typeof sid === 'number' && typeof event === 'string',
               "typeof sid === 'number' && typeof event === 'string'")){
            trace && console.log('bad RPC.invoke message')
          } else {
            this.on_invoke(sid, event)
          }
          break
        }
        
        case RPC.chunk: {
          var sid = m[1], buf = m[2][0]
          if(!(typeof sid === 'number', Buffer.isBuffer(buf),
               "typeof sid === 'number', Buffer.isBuffer(buf)")){
            trace && console.log('bad RPC.chunk message')
          } else {
            this.on_chunk(sid, buf)
          }
          break
        }
        
        case RPC.choke: {
          var sid = m[1]
          if(!(typeof sid === 'number',
               "typeof sid === 'number'")){
            trace && console.log('bad RPC.choke message')
          } else {
            this.on_choke(sid)
          }
          break
        }
        
        case RPC.error: {
          var errno = m[1], message = m[2][0]
          if(!(typeof errno === 'number', typeof message === 'string',
               "typeof errno === 'number', typeof message === 'string'")){
            trace && console.log('bad RPC.error message', m)
          } else {
            this.on_error(errno, message)
          }
          break
        }
        
        case RPC.terminate: {
          var code = m[1], reason = m[2][0]
          if(!(typeof code === 'number', typeof message === 'string',
               "typeof code === 'number', typeof message === 'string'")){
            trace && console.log('bad RPC.terminate message', m)
          } else {
            this.on_terminate(code, reason)
          }
          break
        }

        default: {
          trace && console.log('discarding unknown message type', m)
        }
      }
    },

    data: function(buf){
      __assert(Buffer.isBuffer(buf), 'Buffer.isBuffer(buf)')
      trace && console.log('channel got data', buf)
      
      if(this._inBuffer){
        this._inBuffer = Buffer.concat([this._inBuffer, buf])
      } else {
        this._inBuffer = buf
      }
      var m
      while(m = unpackMessage(this._inBuffer)){

        if(m === _mpFail){
          trace && console.log('bad message framing')
          this.close()
        }
        
        trace && console.log('worker got message', m)
        trace && console.log('unpackMessage.bytesParsed', remaining)
        
        var remaining = this._inBuffer.length - unpackMessage.bytesParsed
        
        trace && console.log('remaining', remaining)
        
        this._hdl.message(m)
        
        if(0 < remaining){
          trace && console.log('remaining buffer', this._inBuffer.slice(unpackMessage.bytesParsed))
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

//compatibility
module.exports.communicator = Channel

