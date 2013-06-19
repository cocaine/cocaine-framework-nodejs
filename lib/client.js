
var EventEmitter = require("events").EventEmitter
var __assert = require("assert")

var bindings = require("bindings")
var Channel = bindings("nodejs_cocaine_framework").communicator
var Session = require("./session").Session

var util = require("./util")

var dbg = 0

function Client(){
  EventEmitter.apply(this,arguments)
  this._hdl = {}
  this._sessions = {}
  util.bindHandlers(this.hdl,this._hdl,this)
}

Client.prototype = {
  __proto__:EventEmitter.prototype,
  Session:function(){
    var s = new Session()
    s._id = this.__cls._sid++
    s.owner = this
    return s
  },
  _send:function(msg){
    this._handle.send(msg)
  },
  connect:function(){
    __assert(!this._handle)
    var e = this._endpoint
    if(Array.isArray(e)){
      this._handle = new Channel(e[0],e[1])
    } else {
      this._handle = new Channel(e)
    }
    this._handle.owner = this
    util.setHandlers(this._handle,this._hdl)
  },
  close:function(){
    __assert(this._handle)
    this._handle.close()
    this._handle.owner = null
    util.unsetHandlers(this._handle,this._hdl)
    this._handle = null
  },
  hdl:{
    on_chunk:function(sid,data){
      dbg && console.log("Client.on_chunk",sid,data,typeof data)
      var s = this._sessions[sid]
      if(s){
        s.push(data)
      }
    },
    on_choke:function(sid){
      dbg && console.log("Client.on_choke",sid)
      var s = this._sessions[sid]
      if(s){
        s.choke()
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_error:function(sid,code,message){
      dbg && console.log("Client.on_error",sid,code,message)
      var s = this._sessions[sid]
      if(s){
        s.pushError(code,message)
        s.owner = null
        delete this._sessions[sid]
      }
    }
  }
}

module.exports = {
  Client:Client

}



