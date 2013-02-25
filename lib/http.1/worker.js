

function Server(options,connListener){
  this._handle = null
  this._connections = 0
  this._connectionKey = ""

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


