#!/usr/bin/node

var Q = require("q")
var co = require("..")
var argv = require("optimist").argv
var mp = require("msgpack")
var __assert = require("assert")
var crypto = require("crypto")
var http = require("http")

var S,L,W

co.getServices(["storage","logging"],function(Storage,Logger){
  S = new Storage()
  L = new Logger(argv.app)

  W = new co.Worker(argv)
  W.listen()
  var handle = W.getListenHandle("hash")
  var server = http.createServer()

  server.listen(handle)
  
  server.on("request",function(rq,rs){
    L.debug("got node.http request")
    var sha512 = crypto.createHash("sha512")
    rq.resume()
    rq.on("data",function(data){
      sha512.update(data)
    })
    rq.on("end",function(){
      var d = sha512.digest("hex")+"\n"
      rs.writeHead(200,{
        "content-type":"text/plain",
        "content-length":"" + d.length,
        "x-by":"rocket bees"})
      rs.end(d)
    })
  })

  server.on("close",function(){
    console.log("worker terminating")
    S.close()
    L.close()
    process.exit(0)
  })

})




