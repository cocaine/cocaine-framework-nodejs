#!/usr/bin/env node

var Q = require("q")
var co = require("..")
var argv = require("optimist").argv
var mp = require("msgpack")
var __assert = require("assert")
var crypto = require("crypto")

var W,S,L

co.getServices(["storage","logging"],function(Storage,Logger){
  S = new Storage()
  L = new Logger(argv.app)
  
  var W = new co.Worker(argv)
  W.on("hash",function(stream){
    //console.log("got http event")
    L.debug("==== got hash event")
    var sha512 = crypto.createHash("sha512")
    var request
    stream.on("data",function(data){
      __assert(request === undefined)
      //request = W._unpackHttpRequest(data)
      request = data
      sha512.update(data)
    })
    
    stream.on("end",function(){
      var d = sha512.digest("hex")
      stream.write(
        mp.pack({code:200,
                 headers:[
                   ["content-type","text/plain"],
                   ["content-length",""+(d.length+1)],
                   ["x-by","worker"+argv.uuid]]}))
      stream.write(d+"\n")
      stream.end()
    })
  })
  W.on("_terminate",function(){
    console.log("worker terminating")
    S.close()
    L.close()
    process.exit(0)
  })
})




