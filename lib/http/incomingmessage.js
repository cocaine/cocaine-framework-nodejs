
var Stream=require("stream")
var __assert=require("assert")
var END_OF_FILE = 23576

function IncomingMessage(socket){
  this.socket = socket
  this.connection = socket

  this.method = null
  this.url = ""
  this.httpVersion = null
  this.headers = {}
  this.trailers = {} //not really used
  this.complete = false

  this.readable = true
  this.writable = false

  this._paused = false
  this._pendings = []

  this._endEmitted = false

  this._decoder = null

  Stream.call(this)
}

IncomingMessage.prototype={
  __proto__:Stream.prototype,

  pause:function(){
    this._paused = true
    this.socket.pause()},
  
  resume:function(){
    this._paused = false
    if(this.socket){
      this.socket.resume()
    this._emitPending()}},

  destroy:function(err){
    this.socket.destroy(err)},

  setEncoding:function(encoding){
    var StringEncoder = require("string_decoder").StringDecoder
    this._decoder = new StringDecoder(encoding)
  },

  _emitPending:function(callback){
    if(this._pendings.length){
      var self = this
      process.nextTick(function(){
        while(!self._paused && self._pendings.length){
          var chunk = self._pendings.shift()
          if(chunk !== END_OF_FILE){
            __assert(Buffer.isBuffer(chunk))
            self._emitData(chunk)
          } else {
            __assert(self._pendings.length === 0)
            self.readable = false
            self._emitEnd()
          }
        }
        callback && callback()
      })
    } else if(callback){
      callback()
    }
  },
  
  _emitData:function(data){
    if(this._decoder){
      var string = this._decoder.write(data)
      if(string.length){
        this.emit("data",string)
      }
    } else {
      this.emit("data",data)
    }
  },
  
  _emitEnd:function(){
    if(!this._endEmitted){
      console.log("js: ==== emitting end on incoming message")
      this.emit("end")
      this._endEmitted = true
    }
  },

  _addHeaderLine:function(k,v){
    var dest = this.complete ? this.trailers : this.headers
    __assert(this.complete === false,
             "trailing headers are not implemented")
    k = k.toLowerCase()
    switch(k){
      //array headers
    case "set-cookie":
      if(k in dest){
        dest[k].push(v)
      } else {
        dest[k] = [v]
      }
      break
    case 'accept':
    case 'accept-charset':
    case 'accept-encoding':
    case 'accept-language':
    case 'connection':
    case 'cookie':
    case 'pragma':
    case 'link':
    case 'www-authenticate':
    case 'proxy-authenticate':
    case 'sec-websocket-extensions':
    case 'sec-websocket-protocol':
      if(k in dest){
        dest[k] += ", "+v
      } else {
        dest[k] = v
      }
      break
    default:
      if(k.slice(0,2) == "x-"){
        if(k in dest){
          dest[k] += ", " + v
        } else {
          dest[k] = v
        }
      } else {
        if(!(k in dest)){
          dest[k] = v
        }
      }
      break
    }
  }
}


module.exports = IncomingMessage
