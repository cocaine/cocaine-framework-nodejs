


var CW = require('./index').Worker

var w=new CW()

w.on("message",function(msg){
  console.log("received:",msg)
})

var zmq=require("zmq")

sock=zmq.socket("pub")

sock.bindSync("tcp://127.0.0.1:5555")

setInterval(
  function(){
    var s=Math.random()*0x100000000
    console.log("sending...",s)
    sock.send(s)},
  1000)



