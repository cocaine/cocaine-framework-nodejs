
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var bindings = require('bindings')
var Channel = bindings('nodejs_cocaine_framework').communicator
var Session = require('./session').Session

var util = require('./util')

var ERRNO = require('./errno')

var dbg = 1

function Client(){
  EventEmitter.apply(this,arguments)
  this._hdl = {}
  this._sessions = {}
  this._connect_timeout0 = 32 + ~~(32*Math.random())
  this._connect_timeout = this._connect_timeout0
  this._connect_timeout_hwm = 10000
  this._connect_timer_hdl = null
  this._connecting = false
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
  _send: function(msg){
    if(this._connecting){
      this._buffer.push(msg)
    } else {
      return this._handle.send(msg)
    }
  },
  connect: function(endpoint){
    __assert(!this._handle)
    this._endpoint = endpoint
    var e = this._endpoint
    try{
      if(Array.isArray(e)){
        this._handle = new Channel(e[0],e[1])
      } else {
        this._handle = new Channel(e)
      }
      this._handle.owner = this
      util.setHandlers(this._handle, this._hdl)
    } catch (err){
      if(typeof err === 'number'){
        this._hdl.on_socket_error(err)
      } else {
        this.emit('error', err)
      }
    }
  },
  _onConnect:function(){
    __assert(this._handle && this._connecting)
    this._connecting = false
    var m
    while(m = this._buffer.shift()){
      this._handle(send(m))
    }
  },
  close: function(){
    if(this._handle){
      for(var id in this._sessions){
        var s = this._sessions[id]
        s.pushError('ECONNRESET', 'sessions channel closed')
        //it's session's responsibility to remove itself from ._sesstions
      }
      this._handle.close()
      this._handle.owner = null
      util.unsetHandlers(this._handle, this._hdl)
      this._handle = null
    }
  },
  
  hdl: {
    on_connect: function(){
      this._onConnect()
    },
    on_chunk: function(sid, data){
      dbg && console.log('Client.on_chunk',sid, data, typeof data)
      var s = this._sessions[sid]
      if(s){
        s.push(data)
      }
    },
    on_choke: function(sid){
      dbg && console.log('Client.on_choke', sid)
      var s = this._sessions[sid]
      if(s){
        s.choke()
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_error: function(sid, code, message){
      dbg && console.log('Client.on_error', sid, code, message)
      var s = this._sessions[sid]
      if(s){
        s.pushError(code, message)
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_socket_error: function(errno) {
      dbg && console.log('Client.hdl.on_socket_error',errno)
      var e = new Error('Client._handle socket error:'+errno)
      e.code = ERRNO.code[errno]
      this.close()
      this.emit('error',e)
    }
  }
}

module.exports = {
  Client:Client

}



