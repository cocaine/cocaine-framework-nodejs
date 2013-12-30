
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var mp = require('msgpack')

var slice = Array.prototype.slice

var trace = 0

module.exports = function(Promise) {
  
  function Session(id, deferred){
    __assert(typeof id === 'number', 'no id passed to session')
    __assert(deferred, 'no deferred passed to session')
    this.deferred = Promise.defer()
    this._id = id
    this._done = false
    this._chunk = undefined
    this._callTimer = 0
    this._unpacker = null
    var _this = this
    this._timeoutHandler = function(){
      __assert(!_this._done,'!_this._done')
      _this._done = true
      var err = new Error('call timeout')
      Promise.reject(_this.deferred, err)
    }
    this._resetTimeout()
  }

  Session.prototype = {
    _resetTimeout: function(){
      clearTimeout(this._callTimer)
      this._callTimer = setTimeout(this._timeoutHandler, CALL_TIMEOUT)
    },
    chunk: function(chunk){
      __assert(this._chunk === undefined, 'this._chunk === undefined')
      this._chunk = chunk
      var unpacker = this._unpacker || mp.unpack
      this._result = unpacker(chunk)
    },
    choke: function(){
      __assert(!this._done, '!_this._done')
      this._done = true
      clearTimeout(this._callTimer)
      Promise.fulfill(this.deferred, this._result)
    },
    error: function(code, message) {
      __assert(!this._done, '!this._done')
      this._done = true
      clearTimeout(this._callTimer)
      var err = new Error(message)
      err.code = code
      Promise.reject(this.deferred, err)
    }
  }

  return {
    unpackWith: function(unpacker){
      return function(mid){
        return function(){
          var args = slice.call(arguments)
          var d = Promise.defer()
          var sid = this.__sid++
          var S = new Session(sid, d)
          S._unpacker = unpacker
          this._sessions[S._id] = S
          this.send([mid, S._id, args])
          return Promise.promise(S.deferred)
        }
      }
    },
    unpacking: function(mid){
      return function(){
        var args = slice.call(arguments)
        var d = Promise.defer()
        var sid = this.__sid++
        var S = new Session(sid, d)
        this._sessions[S._id] = S
        var msg = [mid, S._id, args]
        this.send(msg)
        return Promise.promise(S.deferred)
      }
    }
  }
}


