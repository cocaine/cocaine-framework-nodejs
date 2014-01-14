
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var mp = require('msgpack')

var slice = Array.prototype.slice

var trace = 0

module.exports = function(Fiber){

  function Session(id, fiber){
    __assert(typeof id === 'number', 'no id passed to session')
    __assert(fiber, 'no fiber passed to session')
    this.fiber = fiber
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
      _this.fiber.throwInto(err)
    }
    this._resetTimeout()
  }

  Session.prototype = {
    _resetTimeout: function(){
      clearTimeout(this._callTimer)
      this._callTimer = setTimeout(this._timeoutHandler, CALL_TIMEOUT)
    },

    pushChunk: function(chunk){
      __assert(this._chunk === undefined, 'this._chunk === undefined')
      this._chunk = chunk
      var unpacker = this._unpacker || mp.unpack
      this._result = unpacker(chunk)
    },
    pushChoke: function(){
      __assert(!this._done, '!this._done')
      this._done = true
      clearTimeout(this._callTimer)
      this.fiber.run(this._result)
    },
    pushError: function(code, message) {
      __assert(!this._done, '!this._done')
      this._done = true
      clearTimeout(this._callTimer)
      var err = new Error(message)
      err.code = code
      this.fiber.thowInto(err)
    }
  }

  return {
    unpackWith: function(unpacker){
      return function(mid){
        return function(){
          var args = slice.call(arguments)
          var sid = this.__sid++
          var S = new Session(sid, Fiber.current)
          S._unpacker = unpacker
          this._sessions[S._id] = S
          this._send([mid, S._id, args])
          return Fiber.yield()
        }
      }
    },
    unpacking: function(mid){
      return function(){
        var args = slice.call(arguments)
        var sid = this.__sid++
        var S = new Session(sid, Fiber.current)
        this._sessions[S._id] = S
        this._send([mid, S._id, args])
        return Fiber.yield()
      }
    },
    streaming: streamingMethod
  }
}




