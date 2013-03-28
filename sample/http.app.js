
var http = require("http")
var mp = require("msgpack")

var S=new http.Server(function(rq,rs){
  rq.on("data",function(chunk){
    console.log("==== js: got chunk on request",chunk.length)
  })
  rq.on("end",function(){
    console.log("==== js: got end on request")
    // rs.connection.write(
    //   mp.pack({code:200,
    //            headers:[
    //              ["content-type","text/plain"],
    //              ["x-by","space-monkeys"]]}))
    // rs.connection.end("aijdofjsdfoijasdpof\n")
    rs.writeHead(200,{"content-type":"text/plain",
                      "x-by":"space-monkeys"})
    rs.end("hugechunkofdata\n")
  })
})

S.listen({handle:process.__cocaine})

setTimeout(function(){S.close()},20000)


