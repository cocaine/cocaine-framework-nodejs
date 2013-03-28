
var events = require("events")
var Stream = require("stream")
var timers = require("timers")
var util = require("util")
var __assert = require("assert")

function nop(){}

/* Bit flags for socket._flags */
var FLAG_GOT_EOF = 1 << 0;
var FLAG_SHUTDOWN = 1 << 1;
var FLAG_DESTROY_SOON = 1 << 2;
var FLAG_SHUTDOWN_QUEUED = 1 << 3;

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
  this.__init(options)
}

exports.Socket = Socket

Socket.prototype={
  __proto__:Stream.prototype,

  __init:function(options){
    Stream.call(this)
    switch (typeof options) {
    case 'number':
      //options = { fd: options }; // Legacy interface.
      throw new TypeError("Socket on fd is not supported")
    case 'undefined':
      options = {};
      break;
    }

    this._handle = options.handle; // private

    this._handle.owner = this
    this._handle.onread = this._onRead
    this.allowHalfOpen = options.allowHalfOpen;

    console.log("==== js: this.allowHalfOpen =",this.allowHalfOpen)
    
  },

  pause:function(){
    this._paused = true},
  resume:function(){
    this._paused = false
    // var self = this
    // process.nextTick(function(){
    //   self._emitPendingData()})
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
      shutdownReq.oncomplete = this._afterShutdown
    }
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
  setEncoding:function(encoding){
    var StringEncoder = require("string_encoder").StringDecoder
    this._decoder = new StringDecoder(encoding)
  },
  
  address:function(){
    if(this._handle && this._handle.getsockname){
      return this._handle.getsockname()}
    return null
  },
  
  get remoteAddress(){
    return this._getpeername().address
  },
  get remotePort(){
    return this._getpeername().port},
  
  get bytesWritten(){
    return this._bytesDispatched
  },

  get readyState(){
    if (this._connecting) {
      return 'opening';
    } else if (this.readable && this.writable) {
      return 'open';
    } else if (this.readable && !this.writable) {
      return 'readOnly';
    } else if (!this.readable && this.writable) {
      return 'writeOnly';
    } else {
      return 'closed';
    }
  },
  get bufferSize(){
    if(this._handle){
      return this._handle.writeQueueSize}
  },

  _emitPendingData:function(){
    while(0 < this._pending_data.length
          && !this._paused
          && !this.destroyed){
      this.emit("data",this._pending_data.shift())
    }
  },

  _afterWrite:function(status,handle,req){
    var self = handle.owner
    if(self.destroyed){
      return}
    if(status){
      if(errno == "EINTR"){
        self.emit("worker_close")
        self._destroy()
      }else{
        self._destroy(errnoException(errno, "write"),req.cb)
      }
    }
    timers.active(self)
    self._pendingWriteReqs--
    if(self._pendingWriteReqs == 0){
      self.emit("drain")}
    if(req.cb){
      req.cb()}
    if(self._pendingWriteReqs == 0 && self._flags & FLAG_DESTROY_SOON){
      self._destroy()}
  },
  
  _afterShutdown:function(status,handle,req){
    self = handle.owner
    __assert(self._flags & FLAG_SHUTDOWN)
    __assert(!self.writable)
    if(self.destroyed){
      return}
    if(self._flags & FLAG_GOT_EOF || !self.readable){
      self._destroy()
    }
  },
  
  _onRead:function(chunk){
    var handle = this
    var self = handle.owner
    __assert(handle === self._handle, "handle != self._handle")

    timers.active(self)

    if(chunk){
      if(self._decoder){
        var string = self._decoder.write(chunk)
        if(string.length){
          self.emit("data",string)}}
      else{
        if(self._events && self._events.data){
          self.emit("data",chunk)}}
      self.bytesRead += chunk.length
      if(self.ondata){
        self.ondata(chunk,0,chunk.length)}}
    else{
      console.log("==== js: error on stream:",errno)
      if(errno == "EOF"){
        self.readable = false
        __assert(!(self._flags & FLAG_GOT_EOF))
        self._flags |= FLAG_GOT_EOF
        if(!self.writable){
          self._destroy()}
        if(!self.allowHalfOpen){
          console.log("==== js: closing the other side, too")
          self.end()}
        if(self._events && self._events.end){
          self.emit("end")}
        if(self.onend){
          self.onend()}}
      else{
        if(errno == "ECONNRESET"){
          self._destroy()}
        else{
          self._destroy(errnoException(errno,"read"))}}    }
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
      __assert(0,"encoding "+encoding+" not native")
    }
    if(!writeReq || typeof writeReq !== "object"){
      this._destroy(errnoException(errno,"write",cb))
      return false
    }
    writeReq.oncomplete = this._afterWrite
    writeReq.cb = cb
    this._pendingWriteReqs++
    this._bytesDispatched += writeReq.bytes
    return this._handle.writeQueueSize === 0
  },

  _destroy:function(err,cb){
    var self = this
    this.readable = this.writable = false;
    if(this._handle){
      this._handle.close()
      this._handle.onread = nop
      this._handle = null
    }
    fireErrorCallbacks();
    process.nextTick(function(){
      self.emit("close", err?true:false)})
    this.destroyed = true
    if(this.server){
      this.server._connections--
      if(this.server._emitCloseIfDrained){
        this.server._emitCloseIfDrained()}
    }
    function fireErrorCallbacks() {
      if (cb) cb(err);
      if (err && !self.errorEmitted) {
        process.nextTick(function() {
          self.emit('error', err);
        });
        self.errorEmitted = true;
      }
    }
  },
  _getpeername:function(){
    return this._peername
      ||{address:"0.0.0.0",port:1235,family:"IPv4"}
  },
  _setpeername:function(pn){
    this._peername=pn
  }
  
}

var ENCODING_NATIVE={
  'utf8':true,
  'utf-8':true,
  'ascii':true,
  'ucs2':true,
  'ucs-2':true,
  'utf16le':true,
  'utf-16le':true
}

function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);
  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}

