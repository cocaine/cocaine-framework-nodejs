
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var mp = require('msgpack')

var slice = Array.prototype.slice

var trace = 0

function Session(id, cb){
  var _this = this
  this._cb = cb
  this._id = id
  this._done = false
  this._chunk = undefined
  this._result = undefined

  this._callTimer = 0
  this._timeoutHandler = function(){
    __assert(!_this._done)
    _this._done = true
    var err = new Error('call timeout')
    _this.cb(err)
  }
  this._resetTimeout()
}

Session.prototype = {
  _resetTimeout: function(){
    clearTimeout(this._callTimer)
    this._callTimer = setTimeout(this._timeoutHandler, CALL_TIMEOUT)
  },
  chunk: function(chunk){
    __assert(this._chunk === undefined)
    this._chunk = chunk
    this._result = mp.unpack(chunk)
  },
  choke: function(){
    __assert(!this._done)
    this._done = true
    clearTimeout(this._callTimer)
    if(typeof this._cb !== 'function'){
      __assert(this._result === undefined,
               "typeof this._cb !== 'function' && this._result === undefined")
    } else {
      this._cb(null, this._result)
    }
  },
  error: function(code, message) {
    __assert(!this._done)
    this._done = true
    clearTimeout(this._callTimer)
    if(typeof this._cb === 'function'){
      var err = new Error(message)
      err.code = code
      this._cb(err)
    }
  }
}


module.exports.unpacking = function(mid){
  return function(){
    trace && console.log('================ calling method %s', mid)
    if(this._state !== 'connected') return 
    var args = slice.call(arguments)
    var sid = this.__sid++
    if(0 < args.length){
      var cb = args[args.length-1]
      if(typeof cb === 'function'){
        args.pop()
        var S = new Session(sid, cb)
        this._sessions[sid] = S
      }
    }
    this.send([mid, sid, args])
  }
}


