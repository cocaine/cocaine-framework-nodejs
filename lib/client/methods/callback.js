
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var streamingMethod = require('./streaming_method')

var mp = require('msgpack')

var slice = Array.prototype.slice

var debug = require('../../util').debug('co:methods:callback')


function Session(id, cb){
  var _this = this
  this._cb = cb
  this._id = id
  this._owner = null
  this._methodId = undefined
  this._methodName = undefined
  this._svcId = undefined
  this._args = null
  this._done = false
  this._chunk = undefined
  this._result = undefined
  this._unpacker = null
  this._startTime = Date.now()
  this._callTimer = 0
  this._timeoutHandler = function(){
    __assert(!_this._done)
    _this._done = true
    if(_this._owner){
      _this._owner.removeSession(_this)
      _this._owner = null
    }
    var err = new Error('call timeout')
    _this._cb(err)
  }
  this._resetTimeout()
}

Session.prototype = {

  _traceId: function(){
    return util.format('$$%s.%s[%s][%s]', this._svcId, this._methodName, this._methodId, this._id)
  },
  
  _resetTimeout: function(){
    clearTimeout(this._callTimer)
    this._callTimer = setTimeout(this._timeoutHandler, CALL_TIMEOUT)
  },
  
  pushChunk: function(chunk){
    debug(this._traceId(), 'recv chunk')
    __assert(this._chunk === undefined)
    this._chunk = chunk
    var unpacker = this._unpacker || mp.unpack
    this._result = unpacker(chunk)
  },
  pushChoke: function(){
    debug(this._traceId(), 'recv choke')
    __assert(!this._done)
    this._done = true
    this._owner = null
    clearTimeout(this._callTimer)
    if(typeof this._cb !== 'function'){
      __assert(this._result === undefined,
               "typeof this._cb !== 'function' && this._result === undefined")
      var t = Date.now() - this._startTime
      debug(this._traceId(), util.format('no-callback(null, %j), done in '+t+'ms', this._result))
    } else {
      var t = Date.now() - this._startTime
      debug(this._traceId(), util.format('callback(null, %j), done in '+t+'ms', this._result))
      this._cb(null, this._result)
    }
  },
  pushError: function(code, message) {
    debug(this._traceId(), 'recv error', code, message)
    __assert(!this._done)
    this._done = true
    var owner = this._owner
    this._owner = null
    clearTimeout(this._callTimer)
    if(typeof this._cb === 'function'){
      var err = new Error(util.format('%s\n in service %s method %s\n args: %s\n',
                                message, owner._name, this._methodId, util.inspect(this._args)))
      err.code = code
      var t = Date.now() - this._startTime
      debug(this._traceId(), util.format('callback(Error(%s, %s)), done in '+t+'ms', code, message))
      this._cb(err)
    } else {
      var t = Date.now() - this._startTime
      debug(this._traceId(), util.format('no-callback(Error(%s, %s)), done in '+t+'ms', code, message))
    }
  }
}

module.exports.unpackWith = function(unpacker){
  return function(methodId, methodName){
    return function(){
      var args = slice.call(arguments)
      var svcId = this._traceId()
      debug(svcId, ':unpackWith<%s-%s>(%j)', methodId, methodName, args)
      __assert(this._state === 'connected')
      var sid = this.__sid++
      if(0 < args.length){
        var cb = args[args.length-1]
        if(typeof cb === 'function'){
          args.pop()
          var S = new Session(sid, cb)
          S._unpacker = unpacker
          S._owner = this
          S._args = args
          S._methodName = methodName
          S._methodId = methodId
          S._svcId = svcId
          this._sessions[sid] = S
          debug(S._traceId(), 'session created')
        }
      }
      this.send([methodId, sid, args])
    }
  }
}

module.exports.unpacking = function(methodId, methodName){
  return function(){
    var args = slice.call(arguments)
    var svcId = this._traceId()
    debug(svcId, ':unpacking<%s-%s>(%j)', methodId, methodName, args)
    __assert(this._state === 'connected')
    var sid = this.__sid++
    if(0 < args.length){
      var cb = args[args.length-1]
      if(typeof cb === 'function'){
        args.pop()
        var S = new Session(sid, cb)
        S._owner = this
        S._args = args
        S._methodId = methodId
        S._methodName = methodName
        S._svcId = svcId
        this._sessions[sid] = S
        debug(S._traceId(), 'session created')
      }
    }
    this.send([methodId, sid, args])
  }
}

module.exports.streaming = streamingMethod
