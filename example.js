#!/usr/bin/env node

var coca_framework = require("nodejs_cocaine_framework");
var util = require("util");

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai["--app"]+1],
  endpoint: argv[ai["--endpoint"]+1],
  uuid: argv[ai["--uuid"]+1]}

console.log(argv);

console.log(coca_framework)

////// services ////////

function on_resolve(arg)
{
	console.log(arg)

	var storage_service = new coca_framework.ServiceStorage(arg['host'], arg['port']);

	storage_service.Write("collection_name", "key_name", "buzzinga");
	storage_service.List("collection_name");
	storage_service.Read("collection_name", "key_name");
	storage_service.Remove("collection_name", "key_name");

	storage_service.on_storage_read_done = function on_storage_read_done(sid) {
		console.log("read was done, sid=" + sid);
	}

	storage_service.on_storage_read = function on_storage_read(sid, data) {
		console.log("read data=" + data + " sid=" + sid);
	}

	storage_service.on_storage_error = function on_storage_error(sid, code, msg) {
		console.log("Storage error, session id=" 
			+ sid 
			+ ", error code=" 
			+ code 
			+ " message=" 
			+ str);
	}
}

function on_resolve_error(sid, code, str)
{
	console.log("Failed to resolve service, session id=" 
			+ sid 
			+ ", error code=" 
			+ code 
			+ " message=" 
			+ str);
}

var service_resolver = new coca_framework.ServiceResolver("127.0.0.1", 10053);

service_resolver.on_resolve = on_resolve;
service_resolver.on_error = on_resolve_error;

var storage_sid = service_resolver.ResolveByName("storage");

var fake_sid = service_resolver.ResolveByName("fake");

////// services ////////


///// worker /////////
var worker = new coca_framework.Worker(options["endpoint"], options["uuid"]);

worker.on_invoke = function on_invoke(sid, method) {
	console.log("invoke method=" + method + " sid=" + sid);
}

worker.on_chunk = function on_chunk(sid, data) {
	console.log("chunk with data=" + data + " sid=" + sid);
}

worker.on_choke = function on_choke(sid) {
	console.log("choke session id=" + sid);

	worker.Send(sid, "avada kedavra!");
}

worker.on_error = function on_error(sid, code, msg) {
	console.log("error in session id=" + sid + " code=" + code + " message=" + msg);
}

worker.on_terminate = function on_terminate() {
	console.log("terminate session");
}

process.__worker = worker;

///// worker ////////

console.log("app %s has been started", options["app"]);

