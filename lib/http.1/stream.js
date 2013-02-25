

function Socket(options){
  this._handle = null
  this.allowHalfOpen = false
  this.flags = 0
  this.errorEmitted = false
  this.bytesRead = 0
  this._bytesDispatched = 0
  this._paused = true
  this._decoder = null
  this.maxConnections = 0
  this._pendingWriteReqs = 0
  this.readable = false
  this.writable = false
  this.destroyed = false
  this.ondata = null
  this.onend = null
  this._httpMessage = null //incoming or outgoing?
}

Socket.prototype={
  pause:function(){},
  resume:function(){},
  write:function(data){},
  end:function(data){},

  destroy:function(){},
  destroySoon:function(){},
  
  setTimeout:function(ms,cb){},
  setEncoding:function(encoding){},
  
  address:function(){},
  remoteAddress:function(){},
  remotePort:function(){},
  bytesWritten:function(){},

  get readyState(){},
  get bufferSize(){},

  __proto__:Stream.prototype,

  _afterWrite:function(status,handle,req){},
  _afterShutdown:function(status,handle,req){},
  _onRead:function(chunk){},

  _write:function(data,encoding,cb){},
  _destroy:function(err,cb){},
  _getpeername:function(){}
  
}

