#!/opt/nodejs/0.10/bin/node

var util = require("util");
var mp = require("msgpack")
var bindings = require("bindings")
var fs = require("fs")

var Handle = bindings("nodejs_cocaine_framework").communicator;

var _RPC = require("../lib/protocol")._RPC

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai["--app"]+1],
  endpoint: argv[ai["--endpoint"]+1],
  uuid: argv[ai["--uuid"]+1]}

console.log(argv);
console.log(options)


var W = new Handle(options.endpoint)

W.on_heartbeat = function on_heartbeat() {
	console.log("there's a heartbeat");
}

W.on_invoke = function on_invoke(sid, method) {
	console.log("invoke method:" + method + " sid:" + sid);
}

W.on_chunk = function on_chunk(sid, data) {
	console.log("chunk data:" + data + " sid:" + sid);
}

W.on_choke = function on_choke(sid) {
	console.log("choke sid:" + sid);
  
  var d = "Hola!\n"
    
  W.send(mp.pack([_RPC.chunk, sid,
                  [["HTTP/1.0 200 OK",
                    "content-type: text/plain",
                    "content-length: "+d.length,
                    "x-by: worker"+options.uuid,
                    "\r\n"].join("\r\n")]]));
  W.send(mp.pack([_RPC.chunk, sid, [d]]))
  W.send(mp.pack([_RPC.choke, sid, []]))
}

W.on_error = function on_error(sid, code, msg) {
	console.log("error in session id=" + sid + " code=" + code + " message=" + msg);
}

W.on_terminate = function on_terminate() {
	console.log("I am asked to terminate");
  
}

W.on_socket_error = function(){
  var args = [].slice.call(arguments)
  fs.writeFileSync("/tmp/node-worker.log",JSON.stringify(args))
}

W.send(mp.pack([_RPC.handshake, 0, [options.uuid]]))

setInterval(function(){
  W.send(mp.pack([_RPC.heartbeat, 0, []]))
},5000)

