
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var mp = require('msgpack')

var slice = Array.prototype.slice

var trace = 0

var Session = require('../../session').Session


function ClientSession(id){
  Session.apply(this)
  var _this = this
  this._id = id
  this._done = false
  this._callTimer = 0
  this._timeoutHandler = function(){
    __assert(!_this._done)
    _this._done = true
    var err = new Error('call timeout')
  }
  this._resetTimeout()
}

ClientSession.prototype = {
  __proto__: Session.prototype,
  _resetTimeout: function(){
    clearTimeout(this._callTimer)
    this._callTimer = setTimeout(this._timeoutHandler, CALL_TIMEOUT)
  },
  pushChunk:function(chunk){
    __assert(Buffer.isBuffer(chunk))
    this._resetTimeout()
    this.push(chunk)
  }
}

module.exports = function(mid){
  return function(){
    trace && console.log('================ calling method %s', mid)
    __assert(this._state === 'connected')
    var args = slice.call(arguments)
    var sid = this.__sid++
    var S = new ClientSession(sid)
    this.send([mid, sid, args])
    return S
  }
}

