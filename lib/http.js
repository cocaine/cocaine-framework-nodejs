
var msgpack=require("msgpack")

function HTTPReadableStream(rq){
  rq.on("chunk",this.process.bind(this))
  rq.on("choke",this.done.bind(this))
}

HTTPReadableStream.prototype={
  __proto__:EventEmitter.prototype,
  process:function(data){
    if(!this.headers){
      this.headers=msgpack.unpack(data)
      this.emit("request",this)}
    else{
      this.emit("data",data)}},
  end:function(){
    this.emit("end")}
}


HTTPWritableStream.prototype={
  
}