
var __assert = require("assert")
var mp = require("msgpack")

var protocol = require("./protocol")
var RPC = protocol.RPC
var _RPC = protocol._RPC

function Session(){
  this._id = null
  this.owner = null
  this.chunks = null
  this.readable = this.writable = true
  this.paused = false
  this.choked = false
  this.closed = false
}


Session.prototype = {
  __proto__:Stream.prototype,
  pause:function(){
    this.paused = true
    this.chunks = []
  },
  resume:function(){
    var cc = this.chunks
    this.chunks = null
    for(var i = 0; i < cc.length; i++){
      if(cc[i] === null){
        this.readable = false
        this.emit("end",cc[i])
      } else {
        this.emit("data",cc[i])
      }
    }
  },
  push:function(chunk){
    __assert(this.readable && !this.choked)
    if(this.paused){
      this.chunks.push(chunk)
    } else {
      this.emit("data",chunk)
    }
  },
  choke:function(){
    __assert(this.readable && !this.choked)
    if(this.paused){
      this.chunks.push(null)
      this.choked = true
    }
  },
  write:function(data){
    __assert(!this.closed)
    if(Buffer.isBuffer(data)){
      var msg = mp.pack([RPC.chunk,this._id,[data]])
    } else {
      __assert(typeof data === "string")
      var msg = mp.pack([RPC.chunk,this._id,[Buffer(data)]])
    }
    var hdl = this.owner._handle
    hdl.send(msg)
  },
  end:function(data){
    __assert(!this.closed)
    if(data){
      this.write(data)
    }
    var hdl = this.owner._handle
    hdl.send(mp.pack([RPC.choke,this._id,[]]))
  },
  error:function(code,message){
    var hdl = this.owner._handle
    __assert(typeof code === "number" &&
             typeof message === "string")
    hdl.send(mp.pack([RPC.error,this._id,[code,message]]))
  }
  
}

module.exports = {
  Session:Session
}


