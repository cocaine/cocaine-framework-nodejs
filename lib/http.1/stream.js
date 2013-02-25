

function Socket(options){
  this._handle = null
  this.allowHalfOpen = false
  this.flags = 0
  this.errorEmitted = false
  this.bytesRead = 0
  this._bytesDispatched = 0
  this._paused = true
  this._decoder = null
  this._pendingWriteReqs = 0
  this.readable = false
  this.writable = false
  this.destroyed = false
  this.ondata = null
  this.onend = null
  this._httpMessage = null //outgoing message that is being written
  this.parser = null
}

Socket.prototype={
  __proto__:Stream.prototype,

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

  _afterWrite:function(status,handle,req){},
  _afterShutdown:function(status,handle,req){},
  _onRead:function(chunk){},

  _write:function(data,encoding,cb){},
  _destroy:function(err,cb){},
  _getpeername:function(){}
  
}

