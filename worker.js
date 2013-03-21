#!/usr/bin/env node

var coca = require("bindings")("cocaine.node")
var fs=require("fs")
var vm = require("vm")
var net = require("./lib/net")
var http = require("./lib/http")

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai["--app"]+1],
  profile: argv[ai["--profile"]+1],
  uuid: argv[ai["--uuid"]+1],
  configuration: argv[ai["-c"]+1]}

console.log("worker",options.uuid,"starting",Date())

var conf=JSON.parse(fs.readFileSync(options.configuration,"utf8"))

process.__cocaine = new coca.Worker(options)
process.__cocaine.unpackHttpRequest = coca.unpackHttpRequest
  
//var App = require(conf.paths.spool+"/"+options.app)
console.log("starging app")
var App = require("./sample/express.app")




