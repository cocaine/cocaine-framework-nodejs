


function nop(){}

function notImplemented(){
  throw new Error("not implemented")}

function initStreamHanlde(self){
  self._flags=0
  self.errorEmitted=false
  self.bytesRead=0
  self._bytesDispatched=0
}

var Connection=function(streamHandle){
  if(!this instanceof Connection){
    return new Connection(streamHandle)}
  Stream.call(this)
  
  this._handle=streamHandle
  
}

Connection.prototype={
  __proto__:Stream,
  
  setTimeout:function(ms,callback){
    if(0<msecs && !isNaN(msecs) && isFinite(msecs)){
      timers.enroll(this.msecs)
      timers.active(this)
      if(callback){
        this.once("timeout",callback)}}
    else if(msecs===0){
      timers.unenroll(this)
      if(callback){
        this.removeListener("timeout",callback)}}},
  
  _onTimeout:function(){
    this.emit("timeout")},
  
  setNoDelay:nop,
  setKeepAlive:nop,
  
  address:function(){
    return this._handle.getsockname()},
  
  get readyState() {
    if (this._connecting) {
      return 'opening';
    } else if (this.readable && this.writable) {
      return 'open';
    } else if (this.readable && !this.writable) {
      return 'readOnly';
    } else if (!this.readable && this.writable) {
      return 'writeOnly';
    } else {
      return 'closed';}},
  
  get bufferSize(){
    if (this._handle) {
      return this._handle.writeQueueSize + this._connectQueueSize}},
  
  pause:function(){
    this._paused=true
    if(this._handle && !this._connecting){
      this._handle.readStop()}},
  
  resume:function(){
    this._paused=false
    if(this._handle && !this._connecting){
      this._handle.readStart()}},
  
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
  
  _connectQueueCleanUp:function(){
    this._connecting=false
    this._connectQueueSize=0
    this._connectQueue=null},
  
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
    self._connectQueueCleanUp()
    debug("destroy")
    this.readable=this.writable=false
    timers.unenroll(this)
    debug("close")
    if(this._handle){
      this._hanlde.close()
      this._handle.onred=nop
      this._handle=null}
    fireErrorCallbacks()
    process.nextTick(function(){
      self.emit("close",exception?true:false)})
    this.destroyed=true
    if(this.server){
      this.server._connections--
      if(this.server._emitCloseIfDrained){
        this.server._emitCloseIfDrained()}}},
  
  destroy:function(exception){
    this._destroy(exception)},
  
  setEncoding:function(encoding){
    var StringDecoder=require("string_decoder").StringDecoder
    this._decoder=new StringDecoder(encoding)},
  
  _getpeername:function(){
    return {address:"0.0.0.0",port:12345}},
  
  get remoteAddress(){
    return this._getpeername().address;},
  
  get remotePort(){
    return this._getpeername().port;},

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
      switch(encoding){
      case "utf8":
      case "utf-8":
      case "ascii":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        break;
      default:
        data=new Buffer(data,encoding)}}
    else if(!Buffer.isBuffer(data)){
      throw new TypeError("First argument must be a buffer or a string.")}
    return this._write(data,encoding,cb)},
  
  _write:function(data,encoding,cb){
    //timers.active(this)
    if(!this._handle){
      this._destroy(new Error("the socket is closed."),cb)
      return false}
    var writeReq;
    if(Buffer.isBuffer(data)){
      writeReq=this._handle.writeBuffer(data)}
    else{
      switch (encoding) {
      case 'utf8':
      case 'utf-8':
        writeReq = this._handle.writeUtf8String(data);
        break;
      case 'ascii':
        writeReq = this._handle.writeAsciiString(data);
        break;
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        writeReq = this._handle.writeUcs2String(data);
        break;
      default:
        assert(0);}}
    if(!writeReq || typeof writeReq !== "object"){
      this._destroy(errnoException(errno,"write",cb))
      return false}
    writeReq.oncomplete=afterWrite
    writeReq.cb=cb
    this._pendingWriteReqs++
    this._bytesDispatched+=writeReq.bytes
    return this._handle.writeQueueSize==0},
  
  get bytesWritten() {
    var bytes = this._bytesDispatched,
    connectQueue = this._connectQueue;
    if (connectQueue) {
      connectQueue.forEach(
        function(el) {
          var data = el[0];
          if (Buffer.isBuffer(data)) {
            bytes += data.length;}
          else {
            bytes += Buffer.byteLength(data, el[1]);}},
        this)}
    return bytes}
  
  connect:notImplemented,
  listen:notImplemented
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

function onread(buf,oft,len){
  var handle=this
  var self=this.owner
  assert(handle===self._handle,"handle != self._handle")
  timers.active(self)
  var end=oft+len
  if(buf){
    if(self._decoder){
      var string=self._decoder.write(buf.slice(oft,end))
      if(string.length){
        self.emit("data",string)}}
    else{
      if(self._events && self._events.data){
        self.emit("data",buf.slice(oft,end))}}
    self.botesRead+=length
    if(self.ondata){
      self.ondata(buf,oft,end)}}
  else if(errno==="EOF"){
    self.readable=false
    assert.ok(!(self._flags & FLAG_GOT_EOF))
    self._flags |= FLAG_GOT_EOF

    if(!self.writable){
      self._destroy()}
    if(!self.allowHalfOpen){
      self.end()}
    if(self._events && self._events.end){
      self.emit("end")}
    if(self.onend){
      self.onend()}}
  else{
    if(errno==="ECONNRESET"){
      self._destroy()}
    else{
      self._destroy(errnoException(errno,"read"))}}
}



var env_info_map={
  HTTP_CONTENT_LENGTH:"Content-Length",
  HTTP_HOST:"Host",
  HTTP_USER_AGENT:"User-Agent",
  PATH_INFO:"url",
  //QUERY_STRING
  //REMOTE_ADDR
  //REMOTE_PORT
  REQUEST_METHOD:"method"
  //SCRIPT_NAME
  //SERVER_NAME
  //SERVER_PORT
  //SERVER_PROTOCOL
}

function make_info(env){
  var kk=Object.keys(env)
  var info={}
  kk.every(function(k,i){
    if(k in env_info_map){
      info[env_info_map[k]]=env[k]}
    else{
      info[k]=env[k]}
    return true})
  return info
}

function handleOnData(chunk){
  var self=this.owner
  var handle=this
  if(!self._info){
    var env=decode(chunk)
    self._info=make_info(env)
  }
}

function handleOnClose(){
  var self=this.owner
  var handle=this
  
}

var Session=function(sessionHandle){
  EventEmitter.call(this)
  this._handle=sessionHanle
  this._handle.owner=this
  this._handle._on_data=handleOnData
  this._handle._on_close=handleOnClose
  this._info=null
}

utils.inherit(Stream,EventEmitter)


