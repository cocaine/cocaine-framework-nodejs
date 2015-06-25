
var __assert = require('assert')
var net = require('net')
var mp = require('msgpack')


var errno = require('../errno').errno
var util = require('../util')

var _ = require('util')
var fmt = _.format
var inspect = _.inspect

var _mp = require('./mp')
var unpackMessage = _mp.unpackMessage
var _mpFail = _mp.fail

var RPC = require('../protocol').RPC

var debug = require('../util').debug('co:channel')

function notImplemented(){
  throw new Error('method not implemented')
}

function Channel(host, port){
  debug('creating channel')
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
  this._RPC = RPC
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

  _setProtocol: function(RPC){
    this._RPC = RPC
  },

  send: function(buf){
    debug('send', buf)
    __assert(this._socket && Buffer.isBuffer(buf), 'this._socket && Buffer.isBuffer(buf)')
    this._socket.write(buf)
  },

  sendTerminate: function(sid, code, message){
    debug('sendTerminate', sid, code, message)
    var t = true
    __assert(t = (arguments.length === 3
                  && typeof sid === 1
                  && typeof code === 'number'
                  && typeof message === 'string'),
             t || fmt("arguments.length`%s` === 3 && sid`%s` === 1 && typeof code`%s` === 'number' && typeof message`%s` === 'string'",
                      arguments.length, sid, code, message))
    this._socket.send(mp.pack([sid, this._RPC.terminate, [code, message]]))
  },

  close: function(){
    debug('close')
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

  // a hook method, needed for testing only.
  // don't touch! don't use!
  // it's only usage is in test/channel['on socket close just on write']
  _injectSocket: function(sock){
    __assert(!this._socket, '!this._socket')
    this._socket = sock
    sock.on('error', this._hdl.error)
    sock.on('data', this._hdl.data)
    sock.on('end', this._hdl.end)
    sock.on('close', this._hdl.close)
  },

  _destroySocket: function(){
    debug('_destroySocket',(new Error('sample')).stack)
    if(this._socket){
      var s = this._socket
      if(0 < s.bufferSize){
        debug('destroying socket with non-sent data')
      }
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
      var errno0 = errno[err.code] || errno.EBADF
      this._errorFired = true
      this.on_socket_error(errno0)
      this._destroySocket()
    },
    
    message: function(m){
      debug('channel.hdl.message', m)
      if(!(typeof m === 'object' && typeof m.length === number
           && m.length <= 3)){
        debug('RPC message is not a tuple', m)
        this._hdl.error({code: 'EBADMSG'})
        return false
      }
      var sid = m[0], mid = m[1], args = m[2]
      if(!(typeof mid === 'number'
           && typeof sid === 'number'
           && (typeof args === 'object' && typeof args.length === 'number'))){
        debug('bad RPC message tuple')
        this._hdl.error({code: 'EBADMSG'})
        return false
      }
      var owner = this.owner
      if(!owner){
        debug('discarding message `%s` on channel with no owner', m)
        return false
      }

      if(owner.__sid < sid){
        owner.__sid = sid
        
        debug('case this._RPC.invoke')
        var event = args[0]
        if(!(typeof event === 'string',
             "typeof event === 'string'")){
          debug('bad RPC.invoke message')
        } else {
          this.on_invoke(sid, event)
        }
        break

      } else if (sid === 1) {
        // system session
        if(mid === 0){
          // heartbeat
          debug('case this._RPC.heartbeat')
          if(!(args.length === 0)){
            debug('bad RPC.heartbeat message')
          } else {
            this.on_heartbeat()
          }
        } else if (mid === 1){
          // terminate
          debug('case this._RPC.terminate')
          var code = args[0], reason = args[1]
          if(!(typeof code === 'number' && typeof reason === 'string')){
            debug('bad RPC.terminate message', m)
          } else {
            this.on_terminate(code, reason)
          }
        }
        
      } else if (sid <= owner.__sid){

        if(mid === 0){
          // write
          debug('case this._RPC.chunk')
          var buf = args[0]
          if(!(Buffer.isBuffer(buf))){
            debug('bad RPC.chunk message')
          } else {
            this.on_chunk(sid, buf)
          }
          
        } else if (mid === 1){
          // error
          debug('case this._RPC.error')
          var error = args[0], message = args[1]
          if(!(typeof error === 'object' && error.length === 2
               && typeof error[0] === 'number' && typeof error[1] === 'number')){
            debug('bad RPC.error message', m)
          } else {
            var error_category = error[0]
            var errno0 = error[1]
            this.on_error(sid, error_category, errno0, message)
          }

        } else if (mid === 2){
          // close
          debug('case this._RPC.choke')
          if(!(args.length === 0)){
            debug('bad RPC.choke message')
          } else {
            this.on_choke(sid)
          }

        } else {
          debug('discarding a message of unknown type', m)
        }

      }

      return true
    },

    data: function(buf){
      __assert(Buffer.isBuffer(buf), 'Buffer.isBuffer(buf)')
      debug('channel got data', buf)
      
      if(this._inBuffer){
        debug('previous data present')
        this._inBuffer = Buffer.concat([this._inBuffer, buf])
      } else {
        debug('no previous data present')
        this._inBuffer = buf
      }

      var owner = this.owner
      if(!owner){
        debug("won't decode message on channel with no owner, buffering")
        return
      }
      
      while(true){
        var m = unpackMessage(this._inBuffer, this._RPC, owner.__sid+1)
        if(!m){
          debug('not complete/falsish message `%s`', m)
          break
        }

        debug('channel got message', inspect(m, {depth:null}))

        if(m === _mpFail){
          debug('bad message framing')
          //we close it just as if is of some unexpected form
          //this.close()
        } else {
          var remaining = this._inBuffer.length - unpackMessage.bytesParsed
          debug('unpackMessage.bytesParsed`%s`, remaining`%s`', unpackMessage.bytesParsed, remaining)
          
        }

        // this is a bit cryptic.
        // what we do here is, if the message is of some very unexpected form,
        // don't do anything more. Error handling is done elsewhere,
        // here we have to just bail out of this handler
        if(!this._hdl.message(m)){
          return
        }
        
        if(0 < remaining){
          debug('remaining buffer `%s`...', this._inBuffer.slice(unpackMessage.bytesParsed, unpackMessage.bytesParsed+10))
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

