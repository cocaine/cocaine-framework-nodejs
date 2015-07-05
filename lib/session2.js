
var __assert = require('assert')
var mp = require('msgpack-bin')
var Duplex = require('stream').Duplex

var protocol = require('./protocol')
var RPC = protocol.RPC
var ERROR_CATEGORY = protocol.ERROR_CATEGORY

var util = require('./util')

var dbg = 0

function Session(){
  this._id = null
  this.owner = null
  this._hdl = {}
  this._RPC = RPC
  Duplex.call(this)
  util.bindHandlers(this.hdl,this._hdl,this)
}

Session.prototype = {
  __proto__:Duplex.prototype,

  _setProtocol: function(RPC){
    this._RPC = RPC
  },
  // using .push() provided by Duplex

  pushChunk:function(chunk){
    __assert(Buffer.isBuffer(chunk), 'Buffer.isBuffer(chunk)')
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
      //var msg = mp.pack([this._id,this._RPC.chunk,[chunk]])
      var msg = mp.pack([this._id, 0, [chunk]])
    } else {
      __assert(typeof chunk === 'string'
               && typeof encoding === 'string')
      //var msg = mp.pack([this._id,this._RPC.chunk,[new Buffer(chunk,encoding)]])
      var msg = mp.pack([this._id, 0, [new Buffer(chunk,encoding)]])
    }
    this.owner._handle.send(msg)
    cb()
  },

  end:function(){
    var r = Duplex.prototype.end.apply(this,arguments)
    //this.owner._handle.send(mp.pack([this._id,this._RPC.choke,[]]))
    this.owner._handle.send(mp.pack([this._id, 2, []]))
    return r
  },

  error:function(code,message){
    var hdl = this.owner._handle
    //hdl.send(mp.pack([this._id,this._RPC.error,[code,message]]))
    hdl.send(mp.pack([this._id, 1, [[ERROR_CATEGORY.application_error, code], message]]))
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


