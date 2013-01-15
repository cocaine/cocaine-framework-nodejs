


function IoPair(upstream,downstream){
  var self=this
  this._body=""
  this._up=upstream
  this._down=downstream
  this._up.on("chunk",function(chunk){
    if(!self._headers){
      self._headers=msgpack.unpack(chunk)
      emit("request",)
    }
    else{
      self._body+=chunk}})

}


function Server(cocaine){
  this._running=false
  this._cocaine=cocaine
  this._dispatch=new Dispatch(this._cocaine)
}

Server.prototype={
  __proto__:EventEmitter.prototype,
  run:function(){
    if(!this._running){
      this._cocaine.Run(this)
      this._running=true}},
  invoke:function(event,upstream){
    var downstream=new cocaine.WritableStream()
    this.emit(event,upstream,downstream)
    return downstream
  }
}

exports=Server


