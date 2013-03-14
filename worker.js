#!/usr/bin/env node

var coca = require("bindings")("cocaine.node")
var fs=require("fs")

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai["--app"]+1],
  profile: argv[ai["--profile"]+1],
  uuid: argv[ai["--uuid"]+1],
  configuration: argv[ai["-c"]+1]}

console.log("worker",options.uuid,"starting",Date())

var conf=JSON.parse(fs.readFileSync(options.configuration,"utf8"))

function run(){
  var hdl = new coca.Worker(options)
  hdl.onheartbeat=function(){
    console.log("got heartbeat",Date())
  }
  
  hdl.listen()
}

run()


