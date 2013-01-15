#!/usr/bin/env node

var fs=require("fs")

var cocaine=require("./build/Release/cocaine.node")
var Server=require("./lib/server")

var argv=process.argv
var ai={}

for(var i=0;i<argv.length;i++){
  var a=argv[i]
  if(a[0]==="-"){
    ai[a]=i}}

var config_path=argv[ai["-c"]+1]||"/etc/cocaine/cocaine.conf"
var config=JSON.parse(fs.readFileSync(config_path,"utf8"))

var app_name=argv[ai["--app"]+1]
var app_path=config.paths.spool+"/"+app_name

var App=require(app_path).App

App(new Server.run(cocaine))




