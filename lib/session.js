
var __assert = require("assert")
var mp = require("msgpack")
var Stream = require("stream")

var protocol = require("./protocol")
var RPC = protocol.RPC
var _RPC = protocol._RPC

var dbg = 0

function Session(){
  this._id = null
  this.owner = null
  this.chunks = []
  this.readable = this.writable = true
  this.paused = false
  this.choked = false
}


Session.prototype = {
  __proto__:Stream.prototype,
  pause:function(){
    this.paused = true
  },
  resume:function(){
    if(!this.paused) return;
    var c
    this.paused = false;
    while(!this.paused && c = this.chunks.shift()){
      if(c === null){
        this.readable = false
        this.emit("end")
      } else {
        __assert(this.readable)
        this.emit("data",c)
      }
    }
  },

  get closed() {
    return !this.readable && !this.writable
  },

  push:function(chunk){
    __assert(this.readable && !this.choked)
    dbg && console.log("chunk:",chunk, typeof chunk)
    if(this.paused){
      this.chunks.push(chunk)
    } else {
      this.emit("data",chunk)
    }
  },
  choke:function(){
    __assert(this.readable && !this.choked)
    this.choked = true
    if(this.paused){
      this.chunks.push(null)
    } else {
      this.readable = false
      this.emit("end")
    }
  },
  pushError:function(code,message){
    var e = new Error(message)
    e.code = code
    this.emit("error",e)
    this.close()
  },
  

  write:function(data){
    __assert(!this.closed)
    if(Buffer.isBuffer(data)){
      var msg = mp.pack([_RPC.chunk,this._id,[data]])
    } else {
      __assert(typeof data === "string")
      var msg = mp.pack([_RPC.chunk,this._id,[Buffer(data)]])
    }
    var hdl = this.owner._handle
    hdl.send(msg)
  },
  end:function(data){
    __assert(!this.closed)
    if(data){
      this.write(data)
    }
    this.writable = false
    var hdl = this.owner._handle
    hdl.send(mp.pack([_RPC.choke,this._id,[]]))
    this.close()
  },
  error:function(code,message){
    var hdl = this.owner._handle
    __assert(typeof code === "number" &&
             typeof message === "string")
    hdl.send(mp.pack([_RPC.error,this._id,[code,message]]))
    this.close()
  },
  
  close:function(){
    this.readable = this.writable = false
    this.emit("close")
  }

}

module.exports = {
  Session:Session
}


