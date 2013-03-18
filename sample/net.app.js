
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
      to0=setTimeout(sendChunk,100+Math.floor(100*Math.random()))
      conn.write(mp.pack({code:200,
                          headers:[
                            ["content-type","text/plain"],
                            ["x-by","space-monkeys"]]}))
    })
    
    function sendChunk(){
      if(i0<10){
        conn.write("hugechunkofdata\n")
        i0++
        to0=setTimeout(sendChunk,100+Math.floor(100*Math.random()))}
      else{
        conn.end()}
    }
    
  })

S.listen({handle:process.__cocaine})

setTimeout(function(){S.close()},30000)



