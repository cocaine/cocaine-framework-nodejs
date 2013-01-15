
var cocaine=require("cocaine")


var D=cocaine.Dispatch()


D.on("time",process)

function process(rq,rs){
  var headers
  var body=""
  rq.on("chunk",function(data){
    if(!headers){
      headers=msgpack.unpack(data)}
    else{
      body+=data}})
  rq.on("choke",function(){
    rs.write(msgpack.pack({
      code:"200",
      headers:[
        ["content-type","text/plain"]]}))
    rs.write(msgpack.pack(
      new Date.toString()))
    rs.close()})}



