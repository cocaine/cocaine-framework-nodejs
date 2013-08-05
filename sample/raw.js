#!/opt/nodejs/0.10/bin/node

var coca_framework = require('./nodejs_cocaine_framework');
var util = require('util');

var argv=process.argv, ai={}
argv.some(function(a,i){ai[a]=i})

var options={
  app: argv[ai['--app']+1],
  endpoint: argv[ai['--endpoint']+1],
  uuid: argv[ai['--uuid']+1]}

console.log(argv);
console.log(coca_framework)


///// worker /////////
var worker = new coca_framework.communicator(options['endpoint']);

worker.on_heartbeat = function on_heartbeat() {
	console.log('heartbeat');
}

worker.on_invoke = function on_invoke(sid, method) {
	console.log('invoke method=' + method + ' sid=' + sid);
}

worker.on_chunk = function on_chunk(sid, data) {
	console.log('chunk with data=' + data + ' sid=' + sid);
}

worker.on_choke = function on_choke(sid) {
	console.log('choke session id=' + sid);

	worker.Send(sid, 'avada kedavra!');
}

worker.on_error = function on_error(sid, code, msg) {
	console.log('error in session id=' + sid + ' code=' + code + ' message=' + msg);
}

worker.on_terminate = function on_terminate() {
	console.log('terminate session');
}

process.__worker = worker;

///// worker ////////

//// tcp //////

var tcp = new coca_framework.communicator('127.0.0.1', 10053);

tcp.on_chunk = function on_chunk(sid, data) {
	console.log('chunk with data=' + data + ' sid=' + sid);
}

tcp.on_choke = function on_choke(sid) {
	console.log('choke session id=' + sid);

	worker.Send(sid, 'avada kedavra!');
}

tcp.on_error = function on_error(sid, code, msg) {
	console.log('error in session id=' + sid + ' code=' + code + ' message=' + msg);
}

tcp.on_terminate = function on_terminate() {
	console.log('terminate session');
}

//// tcp //////

console.log('app %s has been started', options['app']);

