
var __assert = require('assert')
var mp = require('msgpack')
var Duplex = require('stream').Duplex

var protocol = require('./protocol')
var RPC = protocol.RPC

var util = require('./util')

var dbg = 0

function Session(){
  this._id = null
  this.owner = null
  this._hdl = {}
  Duplex.call(this)
  util.bindHandlers(this.hdl,this._hdl,this)
}

Session.prototype = {
  __proto__:Duplex.prototype,
  
  // using .push() provided by Duplex

  pushChunk:function(chunk){
    __assert(Buffer.hasInstance(chunk))
    this.push(chunk)
  },
  pushChoke:function(){
    __assert(!this.choked)
    this.choked = true
    this.push(null)
  },
  pushError:function(code,message){
    var e = new Error(message)
    e.code = code
    this.emit('error',e)
    this.close()
  },

  _read:function(n){
    // start reading. a no-op, in fact
  },

  _write:function(chunk,encoding,cb){
    if(Buffer.isBuffer(chunk)){
      var msg = mp.pack([RPC.chunk,this._id,[chunk]])
    } else {
      __assert(typeof chunk === 'string'
               && typeof encoding === 'string')
      var msg = mp.pack([RPC.chunk,this._id,[new Buffer(chunk,encoding)]])
    }
    this.owner._handle.send(msg)
  },

  end:function(){
    var r = Duplex.prototype.end.apply(this,arguments)
    this.owner._handle.send(mp.pack([RPC.choke,this._id,[]]))
    return r
  },

  error:function(code,message){
    var hdl = this.owner._handle
    hdl.send(mp.pack([RPC.error,this._id,[code,message]]))
    this.close()
  },

  close:function(){
    this._closed = true
    this.emit('close')
  },

  destroy:function(){
    if(this.owner){
      delete this.owner._sessions[this._id]
      !this._closed && this.close()
    }
  }

}

module.exports = {
  Session:Session
}


