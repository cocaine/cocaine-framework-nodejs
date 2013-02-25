
__new:function(C){
  if(!(this instanceof C)){
    return new C()}
}

function Server(/* [ options, ] listener */) {
  if (!(this instanceof Server)) return new Server(arguments[0], arguments[1]);
  events.EventEmitter.call(this);

  var self = this;

  var options;

  if (typeof arguments[0] == 'function') {
    options = {};
    self.on('connection', arguments[0]);
  } else {
    options = arguments[0] || {};

    if (typeof arguments[1] == 'function') {
      self.on('connection', arguments[1]);
    }
  }

  this._connections = 0;

  // when server is using slaves .connections is not reliable
  // so null will be return if thats the case
  Object.defineProperty(this, 'connections', {
    get: function() {
      if (self._usingSlaves) {
        return null;
      }
      return self._connections;
    },
    set: function(val) {
      return (self._connections = val);
    },
    configurable: true, enumerable: true
  });

  this.allowHalfOpen = options.allowHalfOpen || false;

  this._handle = null;
}

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


