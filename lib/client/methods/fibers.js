
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var streamingMethod = require('./streaming_method')

var mp = require('msgpack')

var slice = Array.prototype.slice

var debug = require('../util').debug('co:methods:fibers')


module.exports = function(Fiber){

  function Session(id, fiber, methodId, methodName){
    __assert(typeof id === 'number', 'no id passed to session')
    __assert(fiber, 'no fiber passed to session')
    this.fiber = fiber
    this._id = id
    this._owner = null
    this._methodId = methodId
    this._methodName = methodName
    this._args = null
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
      this._owner = null
      clearTimeout(this._callTimer)
      this.fiber.run(this._result)
    },
    pushError: function(code, message) {
      __assert(!this._done, '!this._done')
      this._done = true
      var owner = this._owner
      this._owner = null
      clearTimeout(this._callTimer)
      var err = new Error(util.format('<Service %s>.%s error: "%s" args: %s', owner._name, this._methodName, message, util.inspect(this._args)))
      err.code = code
      this.fiber.thowInto(err)
    }
  }

  return {
    unpackWith: function(unpacker){
      return function(methodId, methodName){
        return function(){
          var args = slice.call(arguments)
          var sid = this.__sid++
          var S = new Session(sid, Fiber.current, methodId, methodName)
          S._unpacker = unpacker
          S._owner = this
          S._args = args
          this._sessions[S._id] = S
          this._send([methodId, S._id, args])
          return Fiber.yield()
        }
      }
    },
    unpacking: function(methodId, methodName){
      return function(){
        var args = slice.call(arguments)
        var sid = this.__sid++
        var S = new Session(sid, Fiber.current, methodId, methodName)
        S._owner = this
        S._args = args
        this._sessions[S._id] = S
        this._send([methodId, S._id, args])
        return Fiber.yield()
      }
    },
    streaming: streamingMethod
  }
}




