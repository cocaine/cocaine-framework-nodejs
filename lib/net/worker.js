
var EventEmitter = require("events").EventEmitter
var timers=require("timers")
var util = require("util")
var __assert = require("assert")
var Socket = require("./stream").Socket

function nop(){}

function notImplemented(){
  throw new Error("not implemented")
}

function createServer(){
  return new Server(arguments[0],arguments[1])
}

function Server(/* [ options, ] connListener*/){
  if(!this instanceof Server){
    return new Server(arguments[0],arguments[1])}
  
  this._handle = null
  this._connections = 0
  this._connectionKey = ""
  this.allowHalfOpen = true
  this.maxConnections = 0
  this._heartbeat_ivl = undefined
  
    
  var options, connListener

  EventEmitter.call(this)

  if(typeof arguments[0] === "function"){
    options = {}
    connListener = arguments[0]
  } else {
    options = arguments[0] || {}
    connListener = arguments[1]
  }

  if(typeof connListener ==="function"){
    this.on("connection", connListener)
  }

  this.allowHalfOpen = options.allowHalfOpen || false
  
}


Server.prototype={
  listen:function(/* [handle,] [onceListening] */){
    var h,handle,onceListening
    if(typeof (h = arguments[0]) === "object"){
      h = h._handle || h.handle || h
      handle = h
      onceListening = arguments[1]
    } else {
      onceListening = arguments[0]
    }
    if(handle){
      attachHandle(this,handle,serverHandlers)
    }
    
    if(typeof onceListening === "function") {
      this.once("listening", onceListening)
    }
    this._handle.listen()
    var self = this
    this._heartbeat_ivl = setInterval(function(){
      self._handle.heartbeat()},5000)
    return this
    
    function attachHandle(self,handle,handlers){
      //__assert(handle instanceof cocaine.Worker)
      __assert(handle)
      __assert(!handle.owner && !self.handle,
               "handle already owned")
      self._handle = handle
      handle.owner = self
      for(fn in handlers){
        handle[fn]=handlers[fn]}}
  },

  close:function(cb){
    if(!this._handle){
      throw new Error("Not running")}
    if(cb){
      this.once("close", cb)}
    this._handle.stop()
    //this._handle.close()
    this._handle = null
    clearInterval(this._heartbeat_ivl)
    this._emitCloseIfDrained()
    return this
  },

  log_debug:function(){
    this._handle.log_debug.apply(this._handle,arguments)},
  log_info:function(){
    this._handle.log_info.apply(this._handle,arguments)},
  log_warning:function(){
    this._handle.log_warning.apply(this._handle,arguments)},
  log_error:function(){
    this._handle.log_error.apply(this._handle,arguments)},
  
  address:function(){
    if(this._handle && this._handle.getsockname){
      return this._handle.getsockname()
    } else {
      return null
    }
  },

  __proto__:EventEmitter.prototype,

  _emitCloseIfDrained:function(){
    var self = this
    if (self._handle || self._connections) {
      return}
    process.nextTick(function() {
      self.emit("close")
    })
  },

  listenFD:notImplemented,

  get connections(){
    return this._connections},
  set connections(v){
    return (this._connections=v)}
  
}

var serverHandlers={
  onconnection:function (clientHandle){
    var handle = this
    var self = handle.owner

    if(!clientHandle){
      self.emit("error", errnoException(errno, "accept"))
      return
    }

    if(self.maxConnections && self.maxConnections <= self._connections){
      clientHandle.close()
      return 
    }

    var socket = new Socket({
      handle: clientHandle,
      allowHalfOpen: self.allowHalfOpen
    })
    socket.readable = socket.writable = true

    self._connections++
    socket.server = self

    self.emit("connection", socket)
    socket.emit("connect")
  },
  onheartbeat:function(){
    console.log("got heartbeat",Date())
    if(this._events && this._events.heartbeat){
      this.emit("heartbeat")
    }
  },
  onshutdown:function(){
    console.log("==== js: worker shutting down")
    if(this._heartbeat_ivl){    //fixme
      clearInterval(this._heartbeat_ivl)}
    if(this._events && this._events.shutdown){
      this.emit("shutdown")
    }
  }
}

function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);
  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}

module.exports = {
  Server:Server,
  createServer:createServer
}