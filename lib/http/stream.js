
var ENCODING_NATIVE={
  "utf8":1,
  "utf-8":1,
  "ascii":1,
  "ucs2":1,
  "ucs-2":1,
  "utf16le":1,
  "utf-16le":1}

function nop(){}
function notImplemented(){
  throw new Error("not implemented")}

function Socket(sockHandle,options){
  this._handle=sockHandle
  self._handle.onread=onRead
  Stream.call(this)
  this.allowHalfOpen = options && options.allowHalfOpen;
  self._flags=0
  self.errorEmitted=false
  self.bytesRead=0
  self._bytesDispatched=0
}

Socket.prototype={
  __proto__:Stream.prototype,

  setTimeout:function(ms,callback){},

  _onTimeout:function(){
    this.emit("timeout")},

  address:function(){
    return this._handle.getsockname()},
  
  pause:function(){
    this._paused=true},
  
  resume:function(){
    this._paused=false},
  
  end:function(data,encoding){
    if(this._connecting &&
      ((this._flags & FLAG_SHUTDOWN_QUEUED)===0)){
      if(data){
        this.write(data,encoding)}
      this.writable=false
      this._flags |= FLAG_SHUTDOWN_QUEUED}
    if(!this.writable){return }
    this.writable=false
    if(data){
      this.write(data,encoding)}
    if(!this.readable){
      this.destroySoon()}
    else{
      this._flags |= FLAG_SHUTDOWN
      var shutdownReq=this._handle.shutdown()
      if(!shutdownReq){
        this._destroy(errnoException(errno,"shutdown"))}
      shutdownReq.oncomplete=afterShutdown}
    return true},
  
  destroySoon:function(){
    this.writable=false
    this._flags |= FLAG_DESTROY_SOON
    if(this._pendingWriteReqs===0){
      this._destroy()}},
  
  destroy:function(exception){
    this._destroy(exception)},

  setEncoding:function(encoding){
    var StringDecoder=require("string_decoder").StringDecoder
    this._decoder=new StringDecoder(encoding)},
  
  write:function(data,arg1,arg2){
    //(data,[encoding],[cb]
    var encoding,cb
    if(arg1){
      if(typeof arg1==="string"){
        encoding=arg1
        cb=arg2}
      else if(typeof arg1==="function"){
        cb=arg1}
      else{
        throw new Error("bad arg")}}
    if(typeof data==="string"){
      encoding=(encoding||"utf8").toLowerCase()
      if(!ENCODING_NATIVE[encoding]){
        data=new Buffer(data,encoding)}}
    else if(!Buffer.isBuffer(data)){
      throw new TypeError("First argument must be a buffer or a string.")}
    return this._write(data,encoding,cb)},
  
  get remoteAddress(){
    return this._getpeername().address;},
  
  get remotePort(){
    return this._getpeername().port;},

  get bytesWritten() {
    return this._bytesDispatched},

  get readyState() {
    if (this._connecting) {
      assert(0,"stream can't be connecting")
      /*return 'opening'*/}
    else if (this.readable && this.writable) {
      return 'open'}
    else if (this.readable && !this.writable) {
      return 'readOnly'}
    else if (!this.readable && this.writable) {
      return 'writeOnly'}
    else {
      return 'closed'}},
  
  get bufferSize(){
    if (this._handle) {
      return this._handle.writeQueueSize}},
  
  _getpeername:function(){
    return {address:"0.0.0.0",port:12345}},
  
  _destroy:function(exception,cb){
    var self=this 
    function fireErrorCallbacks(){
      if(cb){
        cb(exception)}
      if(exception && !self.errorEmitted){
        process.nextTick(function(){
          self.emit("error",exception)})
        self.errorEmitted=true}}
    if(this.destroyed){
      fireErrorCallbacks()
      return }
    //self._connectQueueCleanUp()
    debug("destroy")
    this.readable=this.writable=false
    timers.unenroll(this)
    debug("close")
    if(this._handle){
      this._hanlde.close()
      this._handle.onread=nop
      this._handle=null}
    fireErrorCallbacks()
    process.nextTick(function(){
      self.emit("close",exception?true:false)})
    this.destroyed=true
    if(this.server){
      this.server._connections--
      if(this.server._emitCloseIfDrained){
        this.server._emitCloseIfDrained()}}},
  
  _write:function(data,encoding,cb){
    //timers.active(this)
    if(!this._handle){
      this._destroy(new Error("the socket is closed."),cb)
      return false}
    var writeReq;
    if(Buffer.isBuffer(data)){
      writeReq=this._handle.writeBuffer(data)}
    else if(ENCODING_NATIVE[encoding]){
      data=new Buffer(data,encoding)
      writeReq = this._handle.writeBuffer(data)}
    else{
      assert(0,"encoding "+encoding+" not native")}
    if(!writeReq || typeof writeReq !== "object"){
      this._destroy(errnoException(errno,"write",cb))
      return false}
    writeReq.oncomplete=afterWrite
    writeReq.cb=cb
    this._pendingWriteReqs++
    this._bytesDispatched+=writeReq.bytes
    return this._handle.writeQueueSize==0},

  setNoDelay:nop,
  setKeepAlive:nop,

  connect:notImplemented,
  listen:notImplemented,
  _connectQueueCleanUp:notImplemented
}

function afterWrite(status,handle,req){
  var self=handle.owner
  if(self.destroyed){
    return }
  if(status){
    self._destroy(errnoException(errno,"write"),req.cb)
    return}
  timers.active(self)
  self._pendingWriteReqs--
  if(self._pendingWriteReqs===0){
    self.emit("drain")}
  if(req.cb){
    req.cb()}
  if(self._pendingWriteReqs===0 && self._flags & FLAG_DESTROY_SOON){
    self._destroy()}}

function afterShutdown(status,handle,req){
  var self=handle.owner
  assert.ok(self._flags & FLAG_SHUTDOWN)
  assert.ok(!self.writable)
  if(self.destroyed){return }
  if(self._flags & FLAGS_GOT_EOF
     || !self.readable){
    self._destroy()}}

function onRead(chunk){
  var handle=this
  var slef=this.owner
  assert(handle===self._handle,"handle!=self._handle")

  timers.active(self)
  if(chunk){
    if(self._decoder){
      var string=self._decoder.write(chunk)
      if(string.length){
        self.emit("data",string)}}
    else{
      if(self._events && self._events.data){
        self.emit("data",chunk)}
      self.ondata && self.ondata(chunk)}}
  else if(errno==="EOF"){
    self.readable=false
    assert.ok(!(self._flags & FLAG_GOT_EOF))
    self._flags |= FLAGS_GOT_EOF
    if(!self.writable){
      self._destroy()}
    if(!self.allowHalfOpen){
      self.end()}
    if(self._events && self._events.end){
      self.emit("end")}
    if(self.onend){
      self.onend()}}
  else if(errno==="ECONNRESET"){
    self._destroy()}
  else{
    self._destroy(errnoException(errno,"read"))}
}
