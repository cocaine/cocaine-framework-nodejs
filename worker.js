#!/usr/bin/env node

var fs=require("fs")

var _coca=require("./build/Release/cocaine")
var _Worker=_coca.Worker

var mp=require("msgpack")

var L=new (require("./log"))("/tmp/cocaine.log")

var argv=process.argv, ai={}

argv.some(function(a,i){ai[a]=i})

var stub={
  app:"dummy1_29ba18e6f2238f088d521d351d20cabd234d8f29",
  profile:"default",
  uuid:"c4089ded-74da-4a94-a150-2f5c6aac7c90",
  configuration:"/etc/cocaine/cocaine.conf",
}



var options={
  app:argv[ai["--app"]+1],
  profile:argv[ai["--profile"]+1],
  uuid:argv[ai["--uuid"]+1],
  configuration:argv[ai["-c"]+1]
}

L.log("starting",Date())

var W=new _Worker(options)

W._on_open=function(stream){
  stream.bufs=[]
  L.log("got connection",stream)
  stream.write(
    mp.pack({code:200,
             headers:[
               ["content-type","text/plain"]]}))
  L.log("wrote headers")
  var b
  stream.write(b=new Buffer("lolwut"))
  L.log("wrote body")
  stream.end()
  stream.bufs.push(b)
  L.log("closed stream")
}

W.run()

L.log("stopping",Date())



