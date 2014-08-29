
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var mp = require('msgpack')

var slice = Array.prototype.slice

var debug = require('../../util').debug('co:methods:streaming')


var Session = require('../../session').Session


function ClientSession(sid, methodId, methodName){
  Session.apply(this)
  var _this = this
  this._id = sid
  this._done = false
  this._callTimer = 0
  this._methodId = methodId
  this._methodName = methodName
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
  },
  pushChoke: function(){
    var r = Session.apply(this, arguments)
    this._owner = null
    return r
  },
  pushError: function(code, message){
    var owner = this._owner
    this._owner = null
    var err = new Error(util.format('<Service %s>.%s error: "%s" args: %s', owner._name, this._methodName, message, util.inspect(this._args)))
    err.code = code
    this.emit('error', err)
    this.close()
  }
}

module.exports = function(methodId, methodName){
  return function(){
    debug('================ calling method %s, id %s', methodName, methodId)
    __assert(this._state === 'connected')
    var args = slice.call(arguments)
    var sid = this.__sid++
    var S = new ClientSession(sid, methodId, methodName)
    S._owner = this
    this._sessions[S._id] = S
    this.send([methodId, sid, args])
    return S
  }
}

