

var net = require('net')
var __assert = require('assert')
var EventEmitter = require('events').EventEmitter

var mp = require('msgpack-buf')

var util = require('../../lib/util')

var trace = 1

var __chid = 0

function Channel(socket, id){
  EventEmitter.apply(this)
  this._id = id || __chid++
  this._inBuffer = null
  this._socket = socket || null
  this._hdl = {}
  util.bindHandlers(this.hdl, this._hdl, this)
}

Channel.prototype = {
  __proto__: EventEmitter.prototype,

  connect: function(){
    __assert(this._socket === null, 'this._socket === null')
    var s = this._socket = new net.Socket({allowHalfOpen: true})
    s.on('connect', this._hdl.connect)
    s.on('error', this._hdl.error)
    s.on('close', this._hdl.close)
    s.on('data', this._hdl.data)
    s.connect.apply(s, arguments)
  },

  send: function(m, cb){
    this._socket.write(mp.pack(m), cb)
  },

  end: function(){
    __assert(this._socket, 'this._socket')
    this._socket.end()
  },

  close: function(){
    if(this._socket){
      this._destroySocket()
    }
  },

  _initSocket: function(){
    __assert(this._socket, 'this._socket')
    var s = this._socket
    s.on('error', this._hdl.error)
    s.on('data', this._hdl.data)
    s.on('end', this._hdl.end)
    s.on('close', this._hdl.close)
    s.on('connect', this._hdl.connect)
  },

  _destroySocket: function(){
    __assert(this._socket, 'this._socket')
    this._socket.destroy()
    var s = this._socket
    this._socket = null
    s.removeListener('error', this._hdl.error)
    s.removeListener('data', this._hdl.data)
    s.removeListener('end', this._hdl.end)
    s.removeListener('close', this._hdl.close)
    s.removeListener('connect', this._hdl.connect)
  },

  hdl:{
    connect: function(){
      this.emit('connect')
    },
    error: function(err){
      this.emit(err)
    },
    close: function(){
      trace && console.log('socket emitted close')
      this._destroySocket()
    },
    end: function(){
      this.emit('end')
    },
    data: function(buf){
      // jshint -W038
      __assert(Buffer.isBuffer(buf), 'Buffer.isBuffer(buf)')
      trace && console.log('channel got data', buf)
      
      if(this._inBuffer){
        this._inBuffer = Buffer.concat([this._inBuffer, buf])
      } else {
        this._inBuffer = buf
      }

      while(this._inBuffer){

        try{
          var m = mp.unpack(this._inBuffer)
        } catch(e){
          //"Cowardly refusing to pack object with circular reference"
          //"Error serializaing object"
          if(e.message === "Error de-serializing object"
             || e.message === "Encountered unknown MesssagePack object type"){
            trace && console.log('bad message framing')
            this.emit('error', new Error('bad message framing'))
            this.close()
            return
          }

          throw e

        }
        
        if(m === undefined){
          return
        }

        var bytesRemaining = mp.unpack.bytes_remaining
        var bytesParsed = this._inBuffer.length - bytesRemaining

        if(0 < bytesRemaining){
          this._inBuffer = this._inBuffer.slice(bytesParsed)
        } else {
          this._inBuffer = null
        }

        this.emit('message', m)
        
      }
    }
  }
  
}

module.exports.Channel = Channel


