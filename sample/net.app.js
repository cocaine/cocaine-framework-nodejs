
var net = require("net")
var mp = require("msgpack")

var S=new net.Server(
  {allowHalfOpen:true},
  function(conn){
    var to0,i0=0
    conn.on("data",function(chunk){
      console.log("==== js: got chunk on connection",chunk.length)
    })
    
    conn.on("end",function(){
      console.log("==== js: stream end")
      conn.write(mp.pack({code:200,
                          headers:[
                            ["content-type","text/plain"],
                            ["x-by","space-monkeys"]]}))
      conn.end("aosdijfoasidjfoasidfojaisdf\n")
    })
    
  })

S.listen({handle:process.__cocaine})

setTimeout(function(){S.close()},30000)



