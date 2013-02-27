

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

  pause:function(){
    this._paused = true},
  resume:function(){
    this._paused = false
    //here, we should emit pending outpt
  },

  // Arguments data, [encoding], [cb]
  write:function(data,a1,a2){
    var encoding, cb
    if(a1){
      if(typeof a1 == "stirng"){
        encoding = a1
        cb = a2
      } else if (typeof a1 === "function") {
        cb = a1
      } else {
        throw new Error("bad arg")
      }
    }
    if(typeof data === "sting"){
      encoding = (encoding||"utf8").toLowerCase()
      if(!ENCODING_NATIVE[encoding]){
        data = new Buffer(data,encoding)
      }
    } else if(!Buffer.isBuffer(data)){
      throw new TypeError("First argument must be a buffer or a string")
    }
    return this._write(data,encoding,cb)
  },

  end:function(data,encoding){
    // if(this._connecting) nothing here
    if(!this.writable){
      return }
    this.writable = false
    if(data){
      this.write(data,encoding)
    }
    if(!this.readable){
      this.destroySoon()
    } else {
      this._flags |= FLAG_SHUTDOWN
      var shutdownReq = this._handle.shutdown()
      if(!shutdownReq){
        this._destroy(errnoException(errno,"shutdown"))
      }
    }
    shutdownReq.oncomplete = this._afterShutdown
    return true
  },

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

