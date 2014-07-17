
var errno = require('../errno').errno
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var mp = require('msgpack')

var _ = require('../util')
var debug = _.debug('co:Resolving')
var bindHandlers = _.bindHandlers

var util = require('util')

var BaseService = require('./base_service').BaseService

var Locator = require('./locator').Locator

module.exports.Resolving = Resolving
module.exports.Session = Session

function normalizeEndpoint(endpoint){
  if(typeof endpoint === 'string' && endpoint.indexOf(':') !== -1){
    endpoint = endpoint.split(':')
    var host = endpoint[0]
    var port = parseInt(endpoint[1])
    __assert(typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536,
             "typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536")
    endpoint = [host, port]
  }
  return endpoint
}

function Session(serviceName, methodName, methodId, args, cb){

  this._serviceName = serviceName
  this._methodName = methodName
  this._methodId = methodId
  this._args = args

  this._done = false
  this._chunks = []
  this._cb = cb

  // fields managed by BaseService
  this._id = null
  this._owner = null

}


Session.prototype = {
  reset: function(){
    __assert(!this._done, "!this._done")
    this._chunks = []
  },
  pushChunk: function(chunk){
    __assert(!this._done)
    this._chunks.push(chunk)
  },
  pushChoke: function(){
    __assert(!this._done)
    this._done = true
    this._cb(null, mp.unpack(Buffer.concat(this._chunks))) // XXX: not safe
  },
  pushError: function(code, message){
    __assert(!this._done)
    this._done = true

    if(typeof this._cb === 'function'){
      var err = new Error(util.format('<Service %s>.%s error: "%s" args: %s', this._serviceName, this._methodName, message, util.inspect(this._args)))
      err.code = code
      this._cb(err)
    }
  }
  
}

Resolving.def = function(name, options){
  __assert(typeof name === 'string')
  options = options || {}

  options.__proto__ = Resolving.prototype.options

  function ResolvingService(){
    Resolving.apply(this, arguments)
  }

  var proto = ResolvingService.prototype = {
    __proto__: Resolving.prototype,
    __name: name,
    __endpoint: null,
    __methods: null,
    __svcproto: null,
    options: options
  }

  proto.__svcproto = proto

  return ResolvingService
}

function bakeServiceProto(proto, definition){
  __assert(proto && typeof proto === 'object')

  debug('bakeServiceProto ================')
  debug('\n\t',proto)
  debug('\n\t',definition)
  
  var name = proto.__name
  __assert(typeof name === 'string')
  
  var endpoint = definition[0]
  var protover = definition[1]
  var _methods = definition[2]

  if(!_methods.length){
    var _ = []
    Object.keys(_methods).some(function(k){
      var i = parseInt(k)
      __assert(!isNaN(i), 'isNaN(i)')
      _[i] = _methods[k]
    })
    _methods = _
  }

  endpoint = normalizeEndpoint(endpoint)

  __assert(protover === 1, 'protover === 1')

  if(proto.__endpoint){
    var check = _methods.every(function(name, idx){
      return proto.__methods[name] === idx
    })
    debug('service methods match:\n %j \n%j', proto.__methods, methods_)
    __assert(check, "service methods match on re-resolve")

  } else {
    var methods_ = {}
    _methods.some(function(name, idx){
      methods_[name] = idx
    })

    proto.__methods = methods_
  }

  proto.__endpoint = endpoint

  debug('result\n', proto)
  debug('bakeServiceProto ----------------')

}


function Resolving(options){
  
  EventEmitter.call(this)
  
  this._service = new BaseService()

  options = options || {}
  options.__proto__ = this.options
  this.options = options
  Object.keys(options).some(function(k){
    this.options[k] = options[k]
  }, this)

  debug('new Resolving options', this.options)

  this._queue = []

  this._connectTimeout = this.options.baseConnectTimeout
  this._connectTries = 0
  this._reconnects = 0
  this._waitingForConnect = false
  this._resolving = false

  this._locatorEndpoint = this.options.locatorEndpoint

  this._hdl = {}
  bindHandlers(this.handlers, this._hdl, this)

  this._service.on('error', this._hdl.serviceError)
  this._service.on('connect', this._hdl.serviceConnect)
}


Resolving.prototype = {

  __proto__: EventEmitter.prototype,

  options: {
    baseConnectTimeout: 10,
    maxConnectTries: 10,
    maxReconnects: Infinity
  },

  close: function(){
    if(this._waitingForConnect){
      this._waitingForConnect = false
    } else {
      if(this._service.state !== 'closed'){
        this._service.close()
      }
    }
  },

  connect: function(){
    this._ensureConnected()
  },

  call: function(methodName, args, cb){
    var methodId = (this.__methods && this.__methods[methodName]) || -1
    __assert(typeof methodId === 'number', "typeof methodId === 'number'")
    var s = new Session(this.__name, methodName, methodId, args, cb)
    this.callSession(s)
  },

  callSession: function(s){
    if(!this._ensureConnected()){
      this._enqueue(s)
    } else {
      this._service.callSession(s)
    }
  },

  _enqueue: function(session){
    this._queue.push(session)
  },

  _pump: function(){
    __assert(this._service._state === 'connected',
             "this._service._state === 'connected'")
    var s
    while(s = this._queue.shift()){
      if(s._methodId === -1){
        s._methodId = this.__methods[s._methodName]
      }
      this._service.callSession(s)
    }
  },

  handlers: {

    serviceConnect: function(){
      this._connectTries = 0
      this._connectTimeout = this.options.baseConnectTimeout
      this.emit('connect')
      this._pump()
    },

    serviceError: function(err){
      var state = this._service._state
      debug('serviceError', err)
      debug('state', state)
      if(state === 'connecting'){
        if(!this._maybeRetryConnect()){
          return this._hdl.fail(err)
        }
      } else if (state === 'connected'){
        if(!this._maybeReconnect()){
          return this._hdl.fail(err)
        }
      } else {
        return this._hdl.fail(err)
      }
    },

    fail: function(err){
      this.emit('error', err)
      this._service._resetSessions(errno[err.code] || errno.ECONNRESET)
    },

    retryAllRequests: function(){
      var ss = this._service._clearSessions()
      this._service.close()
      Object.keys(ss).some(function(id){
        this._enqueue(ss[id])
      })
    },

    _doConnect: function(){
      var _this = this
      var locator
      if(this._waitingForConnect && !this._resolving){
        this._waitingForConnect = false
        this._resolving = true
        _resolve()
      }
      
      function _resolve(){
        locator = new Locator({endpoint: _this._locatorEndpoint})
        locator.resolve(_this.__name, _resolveDone)
        locator.on('error', _locatorError)
      }

      function _resolveDone(err, result){
        _this._resolving = false
        locator.close()
        if(err){
          var e = new Error(util.format('unable to resolve service <%s>: %s', _this.__name, err.message))
          e.error = err
          _this.emit('error', e)
        } else {
          bakeServiceProto(_this.__svcproto, result)
          _this._service.connect(_this.__endpoint)
        }
      }

      function _locatorError(err){
        __assert(_this._resolving, '_this._resolving')
        _this._resolving = false
        var e = new Error(util.format('locator error while resolving service <%s>: %s', _this.__name, err.message))
        e.error = err
        _this.emit('error', e)
      }
    }
    
  },

  _ensureConnected: function(){
    debug('ensureConnected', this._service._state)
    if(this._service._state === 'closed' && !this._waitingForConnect && !this._resolving){
      this._waitingForConnect = true
      this._hdl._doConnect()
    }

    return this._service._state === 'connected'
  },

  // assumes there's some error condition in `connecting` state.
  // is only called from this._service.on('error') handlers.
  _maybeRetryConnect: function(){
    if(this._connectTries < this.options.maxConnectTries){
      this._connectTries++
      this._connectTimeout <<= 1
      this._waitingForConnect = true
      this._reconnectTimer = setTimeout(this._hdl._doConnect, this._connectTimeout)
      return true
    } else {
      return false
    }
  },

  // assumes there's some error condition in `connected` state.
  // if allowed, will restart all pending sessions.
  // is only called from this._service.on('error') handlers.
  _maybeReconnect: function(){
    __assert(this._service._state === 'connected')
    if(this._reconnects++ < this.options.maxReconnects){
      if(this.__stateless){
        this._hdl.retryAllRequests()
      }
      this._ensureConnected()
      return true
    } else {
      return false
    }
  }
  
}


