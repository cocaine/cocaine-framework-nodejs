
function Server(/* [ options, ] connListener*/){
  if(!this instanceof Server){
    return new Server(arguments[0],arguments[1])}
  
  this._handle = null
  this._connections = 0
  this._connectionKey = ""
  this.allowHalfOpen = false
    
  var options, connListener

  events.EventEmitter.call(this)

  if(typeof arguments[0] === "function"){
    options = {}
    connListener = arguments[0]
  } else {
    options = arguments[0] || {}
    connListener = arguments[1]
  }

  if(typeof connListener ==="function"){
    this.on("connection", connListener)
  }

  this.allowHalfOpen = options.allowHalfOpen || false
  
}


Server.prototype={
  listen:function(/* [handle,] [onceListening] */){
    var h,handle,onceListening
    if(typeof (h = arguments[0]) === "object"){
      h = h._handle || h.handle || h
      handle = h
      onceListening = arguments[1]
    } else {
      onceListening = arguments[0]
    }
    if(handle){
      attachHandle(this,handle,onconnection)
    }
    
    if(typeof onceListening === "function") {
      this.on("listening", onceListening)
    }
    this._handle.listen()
    return this
    
    function attachHandle(self,handle,onConnection){
      __assert(handle instanceof cocaine.Dispatch)
      __assert(!handle.owner && !self.handle,
               "handle already owned")
      if(handle){
        self._handle = handle
        handle.owner = self
        handle.onConnection = onConnection}}
  },

Server.prototype.close = function(cb) {
  if (!this._handle) {
    // Throw error. Follows net_legacy behaviour.
    throw new Error('Not running');
  }

  if (cb) {
    this.once('close', cb);
  }
  this._handle.close();
  this._handle = null;
  this._emitCloseIfDrained();

  // fetch new socket lists
  if (this._usingSlaves) {
    this._slaves.forEach(function(socketList) {
      if (socketList.list.length === 0) return;
      socketList.update();
    });
  }

  return this;
};
  
  close:function(cb){},
  log:function(){},
  
  address:function(){},

  __proto__:EventEmitter.prototype,

  _emitCloseIfDrained:function(){},
  listenFD:nop,

  get connections(){
    return this._connections}
  set connections(v){
    return (this._connections=v)}
  
}


function serverOnConnection(clientHandle){
  var handle = this
  var self = handle.owner

  if(!clientHandle){
    self.emit("error", errnoException(errno, "accept"))
    return
  }

  if(self.maxConnections && self.maxConnections <= self._connections){
    clientHandle.close()
    return 
  }

  var socket = new Socket({
    handle: clientHandle,
    allowHalfOpen: self.allowHalfOpen
  })
  socket.readable = socket.writable = true

  self._connections++
  socket.server = self

  self.emit("connection", socket)
  socket.emit("connect")
}

function errnoException(errno,message){}