
var http = require("http")

var S=new http.Server(function(rq,rs){
  rq.on("data",function(chunk){
    console.log("==== js: got chunk on connection",chunk.length)
  })
  rq.on("end",function(){
    rs.writeHead(200,{content-type:"text/plain",
                      x-by:"space-monkeys"})
    rs.end("hugechunkofdata\n")
  })
})

S.listen({handle:process.__cocaine})




