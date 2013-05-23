#!/usr/bin/env node

var Q = require("q")
var co = require("..")
var argv = require("optimist").argv
var mp = require("msgpack")
var __assert = require("assert")

var W,S,L

co.getServices(["storage","logging"],function(Storage,Logger){
  S = new Storage()
  L = new Logger(argv.app)
  
  var W = new co.Worker(argv)
  W.on("hash",function(stream){
    //console.log("got http event")
    L.debug("==== got http event")
    var request
    stream.on("data",function(data){
      __assert(request === undefined)
      request = W._unpackHttpRequest(data)
    })
    
    stream.on("end",function(){
      stream.write(
        mp.pack({code:200,
                 headers:[
                   ["content-type","text/plain"],
                   ["content-length","10"],
                   ["x-by","worker"+argv.uuid]]}))
      stream.write("that's who I am\n")
      var m = S.read("manifests",argv.app)
      m.on("data",function(data){
        //console.log("data",data.length,data)
        L.debug("data "+data.length+" "+data)
        var manifests = mp.unpack(data.slice(3))
        //console.log("manifests",manifests)
        L.debug("manifests" + manifests)
        stream.write(JSON.stringify(manifests,null,2))
      })
      m.on("end",function(){
        stream.end()
      })
      m.on("error",function(error){
        stream.end(JSON.stringify(error))
      })
    })
  })
})




