
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


Server.prototype.listen = function() {
  var self = this;

  var lastArg = arguments[arguments.length - 1];
  if (typeof lastArg == 'function') {
    self.once('listening', lastArg);
  }

  var port = toNumber(arguments[0]);

  // The third optional argument is the backlog size.
  // When the ip is omitted it can be the second argument.
  var backlog = toNumber(arguments[1]) || toNumber(arguments[2]);

  var TCP = process.binding('tcp_wrap').TCP;

  if (arguments.length == 0 || typeof arguments[0] == 'function') {
    // Bind to a random port.
    listen(self, '0.0.0.0', 0, null, backlog);

  } else if (arguments[0] && typeof arguments[0] === 'object') {
    var h = arguments[0];
    if (h._handle) {
      h = h._handle;
    } else if (h.handle) {
      h = h.handle;
    }
    if (h instanceof TCP) {
      self._handle = h;
      listen(self, null, -1, -1, backlog);
    } else if (typeof h.fd === 'number' && h.fd >= 0) {
      listen(self, null, null, null, backlog, h.fd);
    } else {
      throw new Error('Invalid listen argument: ' + h);
    }
  } else if (isPipeName(arguments[0])) {
    // UNIX socket or Windows pipe.
    var pipeName = self._pipeName = arguments[0];
    listen(self, pipeName, -1, -1, backlog);

  } else if (typeof arguments[1] == 'undefined' ||
             typeof arguments[1] == 'function' ||
             typeof arguments[1] == 'number') {
    // The first argument is the port, no IP given.
    listen(self, '0.0.0.0', port, 4, backlog);

  } else {
    // The first argument is the port, the second an IP.
    require('dns').lookup(arguments[1], function(err, ip, addressType) {
      if (err) {
        self.emit('error', err);
      } else {
        listen(self, ip || '0.0.0.0', port, ip ? addressType : 4, backlog);
      }
    });
  }
  return self;
};


Server.prototype={
  listen:function(handle,onceListening){},
  close:function(){},
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


