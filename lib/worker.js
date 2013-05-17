
var EventEmitter = require("events").EventEmitter
var __assert = require("assert")

var mp = require("msgpack")

// TODO: name me right
var Channel = require("../build/Release/nodejs_cocaine_framework")

var Session = require("./session").Session

var util = require("./util")

var protocol = require("./protocol")
var RPC = protocol.RPC
var _RPC = protocol._RPC

var TERMINATE = {
  normal:1,
  abnormal:2
}

function Worker(options){
  EventEmitter.call(this)
  this._endpoint = options.endpoint
  this._id = options.uuid
  this._app = options.app
  this._handle = null
  this._hdl = {}
  this._sessions = {}
  this._disownTimer = null
  this._disownHandler = this.disownHandler.bind(this)
  this._heartbeatHandler = this.heartbeatHandler.bind(this)
  util.bindHandlers(this.hdl,this._hdl,this)
  this.connect()
}

Worker.prototype = {
  __proto__:EventEmitter.prototype,
  connect:function(){
    __assert(this._handle === null)
    this._handle = new Channel(this._endpoint)
    util.setHandlers(this._handle,this._hdl)
    this.handshake()
    this.startHeartbeat()
  },
  close:function(){
    __assert(this._handle,"double close")
    this.stopHeartbeat()
    clearTimeout(this._disownTimer)
    this._handle.close()
    util.unsetHandlers(this._handle,this._hdl)
    this._handle = null
  },
  disownHandler:function(){
    this.emit("_disown")
    this.close()
  },
  heartbeatHandler:function(){
    this.heartbeat()
  },
  resetDisownTimer:function(){
    clearTimeout(this._disownTimer)
    this._disownTimer = setTimeout(this._disownHandler,30000)
  },
  startHeartbeat:function(){
    this._heartbeatTimer = setInterval(this._heartbeatHandler,5000)
  },
  stopHeartbeat:function(){
    clearInterval(this._heartbeatTimer)
  },
  terminate:function(normal,message){
    this.emit("_terminate")
    if(normal){
      this._send([_RPC.terminate,0,[terminate.normal,message]])
    } else {
      this._send([_RPC.terminate,0,[terminate.abnormal,message]])
    }
    this.close()
  },
  handshake:function(){
    this._send([_RPC.handshake,0,[this._id]])
  },
  heartbeat:function(){
    this._send([_RPC.heartbeat,0,[]])
  },
  _send:function(msg){
    this._handle.send(mp.pack(msg))
  },
  hdl:{
    on_terminate:function(code,message){
      this.terminate(code === TERMINATE.normal, message)
    },
    on_heartbeat:function(){
      this.resetDisownTimer()
    },
    on_invoke:function(sid,event){
      __assert(!sid in this._sessions)
      var s = this.Session()
      s._id = sid
      this._sessions[sid] = s
      this.emit(event,s)
    },
    on_chunk:function(sid,data){
      var s = this._sessions[sid]
      if(s){
        s.push(data)
      }
    },
    on_choke:function(sid){
      var s = this._sessions[sid]
      if(s){
        s.push(null)
        delete this._sessions[sid]
      }
    },
    on_error:function(sid,code,msg){
      var s = this._sessions[sid]
      if(s){
        s.error(code,msg)
        delete this._sessions[sid]
      }
    }
  }
}


module.exports = {
  Worker:Worker
}


