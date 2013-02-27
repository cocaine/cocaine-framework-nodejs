

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

  _emitPending:function(callback){},
  _emitData:function(data){},
  _emitEnd:function(){},

  _addHeaderLine:function(k,v){}
}

