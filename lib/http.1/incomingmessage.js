

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

  pause:function(){},
  resume:function(){},

  destroy:function(err){},

  _emitPending:function(){},
  _emitData:function(data){},
  _emitEnd:function(){},

  _addHeaderLine:function(k,v){}
}

