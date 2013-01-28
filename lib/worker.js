
var _coca=require("bindings")("cocaine.node")
var mp=require("msgpack")
var EventEmitter=require("events").EventEmitter
var fs=require("fs")

var defaultWorker

function createWorker(args) {
  if(defaultWorker){
    return defaultWorker}
  else{
    var W=defaultWorker=new Worker(args);
    return W
  }
}


/*
 * args:{
 *   configuration: <configuration file path>
 *   app: <app name>
 *   uuid: <worker uuid>
 *   profile: <worker profile name>
 * }
 */

function Worker(args) {
  this._args=args
  //this._configure()
  var cW=this._coca = new _coca.Worker(this._args)
  cW._on_open = this._on_open.bind(this)
  cW._on_stop = this._on_stop.bind(this)
}


Worker.prototype = {
  __proto__:EventEmitter.prototype,

  _configure:function(){
    this.config = JSON.parse(
      fs.readFileSync(
        this._args.configuration, "utf8"))
  },

  run:function(){
    this._coca.run()
  },

  _on_open:function(stream){
    this.emit("open",stream)},
  
  _on_stop:function(){
    this.emit("stop")},
  
}


module.exports = {
  createWorker:createWorker
}

