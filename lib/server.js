
var mp=require("msgpack")
var EventEmitter=require("events").EventEmitter
var createWorker=require("./worker").createWorker
var __assert=require("assert")

function Request(data,stream){
  this._init_env(data)
  this._stream=stream
  stream._on_data=this._on_data.bind(this)
  stream._on_end=this._on_end.bind(this)
}

Request.prototype={
  __proto__:EventEmitter.prototype,
  _init_env:function(data){
    this.env=mp.unpack(data)
    this._data_pending=0
    if(this.env.HTTP_CONTENT_LENGTH){
      this._data_total=parseInt(this.env.HTTP_CONTENT_LENGTH)
      this._data_pending=this._data_total
      console.log("request data pending",this._data_pending)
      this.body=[]}},
  _on_data:function(data){
    if(this._data_pending){
      __assert(data.length <= this._data_pending)
      this._data_pending-=data.length
      //this.body.push(data)
      console.log("request data pending",this._data_pending)
      this.emit("data",data)
      console.log("request after emit data")}
    console.log("request got chunk",data.length)
    console.log("request data pending",this._data_pending)
    if(this._data_pending===0){
      this.emit("end")}},
  _on_end:function(end){
    console.log("js: request end")
    this.emit("close")
  }
}

function Response(stream){
  this._stream=stream
}

Response.prototype={
  writeHead:function(code,headers){
    var hh=[]
    for(var k in headers){
      hh.push[k,headers[k]]}
    var head=mp.pack({code:code,headers:hh})
    this._stream.write(head)
    return this},
  write:function(data){
    if(!Buffer.isBuffer(data)){
      data=new Buffer(data)}
    this._stream.write(data)
    return this},
  end:function(){
    this._stream.end()}
}

function Server(){
  this._imserver="imserver"
}

Server.prototype={
  __proto__:EventEmitter.prototype,
  bind:function(opts){
    this._worker=createWorker(opts)
    this._worker.on("open",this.hdl.open.bind(this))
    this._worker.on("stop",this.hdl.stop.bind(this))
    return this},
  run:function(){
    __assert(this._worker)
    this._worker.run()
    return this},
  hdl:{
    open:function(stream){
      var self=this
      console.log("js got stream")
      stream._on_data=function(data){
        console.log("js got low data")
        var rq=new Request(data,stream)
        var rs=new Response(stream)
        self.emit("request",rq,rs)
        if(rq._data_pending===0){
          rq.emit("end")}}
      stream._on_end=function(){
        console.log("end before data")}},
    stop:function(){
      this.emit("stop")
    }
  }
}


module.exports=Server

