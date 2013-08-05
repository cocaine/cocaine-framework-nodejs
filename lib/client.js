
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var bindings = require('bindings')
var Channel = bindings('nodejs_cocaine_framework').communicator
var Session = require('./session').Session

var util = require('./util')

var dbg = 0

function Client(){
  EventEmitter.apply(this,arguments)
  this._hdl = {}
  this._sessions = {}
  this._connect_timeout = 32 + ~~(32*Math.random())
  this._connect_timer_hdl = null
  this._connecting = true
  this._buffer = []
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
    if(this._connecting){
      this._buffer.push(msg)
    } else {
      this._handle.send(msg)
    }
  },
  connect:function(){
    __assert(!this._handle)
    this._connecting = true
    this._hdl.try_connect()
  },
  _onConnect:function(){
    __assert(this._connecting && this._handle)
    this._connecting = false
    clearTimeout(this._connect_timer_hdl)
    this._handle.owner = this
    // shouldn't really set/ try_connect here:
    util.setHandlers(this._handle,this._hdl)
    var m
    while(m = this._buffer.shift()){
      this._handle.send(m)
    }
  },
  close:function(){
    __assert(this._handle || this._connecting)
    if(this._handle){
      for(var id in this._sessions){
        var s = this._sessions[id]
        s.pushError('ECONNRESET', 'peer shut down')
      }
      this._handle.close()
      this._handle.owner = null
      util.unsetHandlers(this._handle,this._hdl)
      this._handle = null
    } else { // this._connecting
      clearTimeout(this._connect_timer_hdl)
    }
  },
  hdl:{
    try_connect:function(){
      if(!this._handle){
        var e = this._endpoint
        try {
          if(Array.isArray(e)){
            this._handle = new Channel(e[0],e[1])
          } else {
            this._handle = new Channel(e)
          }
        } catch (e){
          if(this._handle === null){
            this._timeout <<= 1
            this._connect_timer_hdl = setTimeout(this._hdl.try_connect,this._timeout)
            return
          } else {
            throw e
          }
        }
        this._onConnect()
      }
    },
    on_chunk:function(sid,data){
      dbg && console.log('Client.on_chunk',sid,data,typeof data)
      var s = this._sessions[sid]
      if(s){
        s.push(data)
      }
    },
    on_choke:function(sid){
      dbg && console.log('Client.on_choke',sid)
      var s = this._sessions[sid]
      if(s){
        s.choke()
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_error:function(sid,code,message){
      dbg && console.log('Client.on_error',sid,code,message)
      var s = this._sessions[sid]
      if(s){
        s.pushError(code,message)
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_socket_error:function(errno){
      dbg && console.log('Client.hdl.on_socket_error',arguments)
      var e = new Error('Client._handle socket error: '+errno)
      this.emit('error',e)
      e.code = errno
      this.close()
    }
  }
}

module.exports = {
  Client:Client

}



