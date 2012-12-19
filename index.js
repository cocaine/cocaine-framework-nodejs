


var Worker = require("bindings")("_cocaine.node").Worker;
var events = require("events");

Worker.prototype.__proto__=events.EventEmitter.prototype
exports.Worker = Worker;
