#!/usr/bin/env node

var fs=require("fs")

var Logger=require("./log")

var Server=require("./lib/server")

// lots of arbitrary actions

var L=new Logger("/tmp/cocaine.log")

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai["--app"]+1],
  profile: argv[ai["--profile"]+1],
  uuid: argv[ai["--uuid"]+1],
  configuration: argv[ai["-c"]+1]}

L.log("worker",options.uuid,"starting",Date())

var conf=JSON.parse(fs.readFileSync(options.configuration,"utf8"))

//var App=require(conf.paths.spool+"/"+options.app)
var App=require("./sample/app")

global.__app=App(Server,options).run()



