

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
  this._read_data = []
}

Socket.prototype={
  __proto__:Stream.prototype,

  pause:function(){
    this._paused = true},
  resume:function(){
    this._paused = false
    var self = this
    process.nextTick(function(){
      self._emitPendingData()})
  },

  // Arguments data, [encoding], [cb]
  write:function(data,a1,a2){
    var encoding, cb
    if(a1){
      if(typeof a1 == "string"){
        encoding = a1
        cb = a2
      } else if (typeof a1 === "function") {
        cb = a1
      } else {
        throw new Error("bad arg")
      }
    }
    if(typeof data === "string"){
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

  destroy:function(err){
    this._destroy(err)
  },
  
  destroySoon:function(){
    this.writable = false
    this._flags |= FLAG_DESTROY_SOON
    if(this._pendingWriteReqs == 0){
      this._destroy()
    }
  },
  
  
  setTimeout:function(ms,cb){},
  setEncoding:function(encoding){},
  
  address:function(){},
  remoteAddress:function(){},
  remotePort:function(){},
  bytesWritten:function(){},

  get readyState(){},
  get bufferSize(){},

  _emitPendingData:function(){
    while(0 < this._pending_data.length
          && !this._paused
          && !this.destroyed){
      this.emit("data",this._pending_data.shift())
    }
  },

  _afterWrite:function(status,handle,req){},
  _afterShutdown:function(status,handle,req){},
  _onRead:function(chunk){
    if(this._paused){
      this._read_data.push(chunk)}
    else{
      
    }
  },

  _write:function(data,encoding,cb){
    //timers.active(this)
    if(!this._handle){
      this._destroy(new Error("the socket is closed."),cb)
      return false
    }
    var writeReq
    if(Buffer.isBuffer(data)){
      writeReq = this._handle.writeBuffer(data)
    } else if(ENCODING_NATIVE[encoding]){
      data=new Buffer(data,encoding)
      writeReq = this._handle.writeBuffer(data)
    } else {
      assert(0,"encoding "+encoding+" not native")
    }
    if(!writeReq || typeof writeReq !== "object"){
      this._destroy(errnoException(errno,"write",cb))
      return false
    }
    writeReq.oncomplete = afterWrite
    writeReq.cb = cb
    this._pendingWriteReqs++
    this._bytesDispatched += writeReq.bytes
    return this._handle.writeQueueSize === 0
  },

  _write:function(data,encoding,cb){
    
  }

  _destroy:function(err,cb){
    this.readable = this.writable = false;
    if(this._handle){
      this._handle.close()
      this._handle.onread = nop
      this._handle = null
    }
    fireErrorCallbacks();
    process.nextTick(function(){
      self.emit("close", exception?true:false)})
    this.destroyed = true
    if(this.server){
      this.server._connections--
      if(this.server._emitCloseIfDrained){
        this.server._emitCloseIfDrained()}
    }
  },
  _getpeername:function(){}
  
}

