
function onconnection(clientHandle) {
  var handle = this;
  var self = handle.owner;
  if (!clientHandle) {
    self.emit('error', errnoException(errno, 'accept'));
    return}
  if (self.maxConnections && self._connections >= self.maxConnections) {
    clientHandle.close();
    return}
  var socket = new Socket({
    handle: clientHandle,
    allowHalfOpen: self.allowHalfOpen});
  socket.readable = socket.writable = true;
  //clientHandle.readStart();
  self._connections++;
  socket.server = self;
  //DTRACE_NET_SERVER_CONNECTION(socket);
  self.emit('connection', socket);
  socket.emit('connect');
}

function close(){}

function Server(arg0,arg1){
  var options,listener
  if (typeof arg0 === "function") {
    options = {}
    listener = arg0}
  else {
    options = arg0 || {}
    listener = arg1}
  event.EventEmitter.call(this)
  this._handle = null
  this._connections = 0
  this.allowHalfOpen = false
  if(typeof listener==="function"){
    self.on("connection",listener)}
  var self = this
  Object.defineProperty(this,"connections",{
    get:function(){return self._connections},
    set:function(val){
      return (self._connections = val)},
    confugurable:true,
    enumerable:true})
}
util.inherits(Server,events.EventEmitter)
exports.Server = Server

Server.prototype.listen=function(workerHandle,onceListening){
  assert(workerHandle instanceof Worker,
         "can be run only under cocaine worker")
  assert(!workerHandle.owner,
         "workerHandle already owned")
  this._handle=workerHandle
  this._handle.owner=this
  this._handle.onconnection = onconnection
  this._handle.onclose = onclose
  if(typeof onceListening==="function"){
    self.once('listening', onceListening)}
  var r=this._handle.listen()
  if(r){
    var ex = errnoException(errno,"listen")
    self._handle.close()
    self._handle=null
    process.nextTick(function(){
      self.emit("error",ex)})}
  else{
    this._connectionKey = this._uuid
    process.nextTick(function(){
      self.emit("listening")})}
  return this
}

Server.prototype.address=function(){
  return null
}

Server.prototype.close=function(cb){
  if(!this._handle){
    throw new Error("Not running")}
  if(cb){
    this.once("close",cb)}
  this._handle.close()
  this._handle=null
  this._emitCloseIfDrained()
  return this
}

Server.prototype._log=function(){
  var s=Array.prototype.join.call(arguments,", ")
  this._handle.log(s)
}

Server.prototype._emitCloseIfDrained=function(){
  var self=this
  if(self._handle || self._connections){
    return }
  else{
    process.nextTick(function(){
      self.emit("close")})}
}

Server.prototype.listenFd=util.deprecate(
  Server.prototype.listen)

exports={
  Server:Server,
  isIP:cares.isIP,
  isIPv4:nop,
  isIPv6:nop,
  _setSimultaneousAccepts:nop
}

