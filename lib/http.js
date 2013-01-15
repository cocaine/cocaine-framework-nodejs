

var cocaine=require("cocaine")


function Server(){
  this._running=false
}

Server.prototype={
  __proto__:EventEmitter.prototype,
  run:function(){
    if(!this._running){
      cocaine.start(this)
      this._running=true}},
  invoke:function(event,upstream){
    var downstream=new cocaine.WritableStream()
    this.emit(event,upstream,downstream)
    return downstream
  }
}

exports=Server

var S=new Server()

S.run()

S.on({
  hash:function(upstream,downstream){
    upstream.on({
      chunk:function(){},
      choke:function(){
        downstream.write(
          msgpack.pack({
            code:200,
            headers:[["content-type","text/plain"]]}))
        downstream.write(
          "Good evening, everypony!")
        downstream.close()}})}})

cocaine.start(server)


