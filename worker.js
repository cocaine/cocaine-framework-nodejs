#!/usr/bin/env node

var coca = require("bindings")("cocaine.node")
var fs=require("fs")
var mp=require("msgpack")

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
  hdl.onconnection = function(conn){
    conn.onread=function(chunk){
      var rq0,rq1,rq2
      console.log("something was read")
      chunk && console.log(chunk.length)
      if(!chunk){ // we suppose it's because of eof
        writeHead()
        function writeHead(){
          rq0=conn.writeBuffer(mp.pack({code:200,
                                        headers:[
                                          ["x-by","space-monkeys"],
                                          ["Content-Type","text/plain"]]}))
          rq0.oncomplete=writeBody
        }
        function writeBody(){
          console.log("header written")
          rq1=conn.writeBuffer(Buffer("tatata"))
          rq1.oncomplete=shutdownConn
        }
        function shutdownConn(){
          console.log("body written")
          rq2=conn.shutdown()
          rq2.oncomplete=function(){
            console.log("conn closed")
          }
        }
      }
    }
  }
  setInterval(
    function(){hdl.heartbeat()},
    5000)
  
  hdl.listen()
}

run()


