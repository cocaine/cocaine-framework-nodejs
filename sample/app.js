#!/usr/bin/env node

var Q = require("q")
var co = require("..")
var argv = require("optimist").argv
var mp = require("msgpack")

var Storage = co.Service("storage")
var Logger = co.Service("logging")

var W,S,L

Q.all([Storage.resolve(),
       Logger.resolve()])
  .done(function(){
    console.log("services have to be resolved")
    S = new Storage()
    L = new Logger(argv.app)
    
    var W = new co.Worker(argv)
    W.on("hash",function(stream){
      console.log("got http event")
      var meta
      var body = []
      var length = 0
      stream.on("data",function(data){
        if(!meta){
          meta = mp.unpack(data)
        } else {
          body.push(data)
          length += data.length
        }
      })
      
      stream.on("end",function(){
        // stream.write(
        //   mp.pack({code:200,
        //            headers:[
        //              ["content-type","text/plain"],
        //              ["x-by","worker"+argv.uuid]]}))
        stream.write("that's who I am\n")
        var m = S.read("manifests",argv.app)
        m.on("data",function(data){
          console.log("data",data.length,data)
          var manifests = mp.unpack(data.slice(3))
          console.log("manifests",manifests)
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




