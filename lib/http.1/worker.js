
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
      __assert(!h.owner,"handle already owned")
      __assert(h instanceof cocaine.Dispatch,
               "wrong handle type")
      handle = h
      onceListening = arguments[1]
    } else {
      onceListening = arguments[0]
    }
    if(handle){
      this._handle = handle}
    assert(this._handle instanceof cocaine.Dispatch)
    if(typeof onceListening === "function") {
      this.on("listening", onceListening)
    }
    this._handle.listen()
    return this
  },
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


