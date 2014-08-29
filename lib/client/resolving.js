
var errno = require('../errno').errno
var ErrorEmitter = require('../error_emitter').ErrorEmitter
var __assert = require('assert')

var mp = require('msgpack')

var _ = require('../util')
var debug = _.debug('co:Resolving')
var bindHandlers = _.bindHandlers

var errno = require('../errno').errno

var util = require('util')

var BaseService = require('./base_service').BaseService

var Locator = require('./locator').Locator

var debug = require('../util').debug('co:resolving')

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

    if(typeof code === 'object'){
      var e = code
      var err = new Error(util.format('<Service %s>.%s error: "%s" args: %s', this._serviceName, this._methodName, e.message, util.inspect(this._args)))
    } else {
      __assert(typeof code === 'number')
      var err = new Error(util.format('<Service %s>.%s error: "%s" args: %s', this._serviceName, this._methodName, message, util.inspect(this._args)))
      err.code = code
    }

    if(typeof this._cb === 'function'){
      this._cb(err)
    }
  }
  
}

Resolving.def = function(name, options){
  __assert(typeof name === 'string')

  options = options || {}
  options.locator = options.locator || {}

  options.__proto__ = Resolving.prototype.options
  options.locator.__proto__ = Resolving.prototype.options.locator

  function ResolvingService(){
    Resolving.apply(this, arguments)
  }

  var proto = ResolvingService.prototype = {
    __proto__: Resolving.prototype,
    __name: name,
    __endpoint: null,
    __methods: null,
    __svcproto: null,
    __stateless: options.stateless || false,
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
      proto[name] = function(){
        var args = Array.prototype.slice.apply(arguments)
        var cb = args[args.length-1]
        if(typeof cb === 'function'){
          args.pop()
        }
        return this.call(name,args,cb)
      }
    })

    proto.__methods = methods_

  }

  proto.__endpoint = endpoint

  debug('result\n', proto)
  debug('bakeServiceProto ----------------')

}


function Resolving(options){
  
  ErrorEmitter.call(this)
  
  this._service = new BaseService()

  options = options || {}
  options.__proto__ = this.options

  var locatorOptions = options.locator || {}
  locatorOptions.__proto__ = this.options.locator

  var locatorOptions0 = {}
  for(var k in locatorOptions){
    locatorOptions0[k] = locatorOptions[k]
  }
  options.locator = locatorOptions0

  this.options = options

  debug('new Resolving options', this.options)

  this._queue = []

  this._connectTimeout = this.options.baseConnectTimeout
  this._connectTries = 0
  this._reconnects = 0
  this._waitingForConnect = false
  this._resolving = false

  this._hdl = {}
  bindHandlers(this.handlers, this._hdl, this)

  this._service.on('error', this._hdl.serviceError)
  this._service.on('beforeError', this._hdl.serviceBeforeError)
  this._service.on('connect', this._hdl.serviceConnect)

  this._connectTimer = null
}


Resolving.prototype = {

  __proto__: ErrorEmitter.prototype,

  options: {
    stateless: false,
    trySameEndpoint: true,
    baseConnectTimeout: 10,
    maxConnectTries: 10,
    maxReconnects: Infinity,
    locator: {
      baseConnectTimeout: 10,
      maxConnectTries: 10,
      maxReconnects: Infinity,
    }
  },

  _resetCounters: function(){
    this._connectTimeout = this.options.baseConnectTimeout
    this._connectTries = 0
    this._reconnects = 0
  },

  _resetSessions: function(err){
    var q = this._queue
    this._queue = []
    for(var i=0;i<q.length;i++){
      var s = q[i]
      s.pushError(err)
    }
  },

  close: function(e){
    console.log('==== state === ', this._service._state)
    if(this._resolving){
      this._resolving = false
    } else if(this._waitingForConnect){
      clearTimeout(this._connectTimer)
      this._waitingForConnect = false
    } else {
      if(this._service._state !== 'closed'){
        this._service.close()
      }
    }
    this._resetSessions(e)
    this._resetCounters()
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

  errorHandlers: {
    'retry-connect': function(){
      this.close()
      this._resetCounters()
      this._scheduleConnect()
    },
    
    'retry-all-requests': function(){
      var ss = this._service._clearSessions()
      //this._service.close()
      Object.keys(ss).some(function(id){
        this._enqueue(ss[id])
      })
      this.close()
      this._resetCounters()
      this._scheduleConnect()
    }
  },

  handlers: {

    serviceConnect: function(){
      this._connectTries = 0
      this._connectTimeout = this.options.baseConnectTimeout
      this.emit('connect')
      this._pump()
    },

    serviceBeforeError: function(err) {
      var state = this._service._state

      if(state === 'connected'){
        console.log("state === 'connected'")

        if(this._reconnects++ < this.options.maxReconnects) {
          console.log('if policy permits, try reconnect')
          
          if(this.__stateless){
            console.log('if policy permits, rescue sessions')
            this._hdl.rescueAllRequests()
          }

          if(this.options.trySameEndpoint) {
            console.log('if policy permits, try the same endpoint')
            // reconnect at  lower level, with no resolve
            this._service._setErrorHandler(['reconnect', this.__endpoint])
            return true
          }

          this._scheduleConnect()
          this._service._setErrorHandler(['close', err.errno])
          return true
        }
        
        if(this.beforeError(err)){
          // if app wants, do something
          //   (available:
          //      (fail requests; reset counters and retry the cycle
          //      one more time)
          //      (rescue sessions; reset counters; retry all the
          //      cycle one more time))
          var hdl = this._popErrorHandler()
          this._callErrorHandler(hdl)
          return true
        }
        
      } else if(state === 'connecting'){

        if(this._connectTries < this.options.maxConnectTries) {
          // if policy permits, reconnect with resolve
          this._scheduleConnect()
          this._service._setErrorHandler(['close', err.errno])
          return true
        }

        if(this.beforeError(err)){
          // if app wants, do something
          var hdl = this._popErrorHandler()
          this._callErrorHandler(hdl)
          return true
        }
      }
      
    },

    serviceError: function(err){
      this.emit('error', err)
    },

    rescueAllRequests: function(){
      var ss = this._service._clearSessions()
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
        locator = new Locator(_this.options.locator)
        locator.resolve(_this.__name, _resolveDone)
        locator.on('beforeError', _locatorBeforeError)
        locator.on('error', _locatorError)
      }

      function _resolveDone(err, result){
        if(!_this._resolving){
          console.log('resolve was cancelled by this.close()')
          return
        }
        _this._resolving = false
        locator.close()
        if(err){
          var e = new Error(util.format('unable to resolve service <%s>: %s', _this.__name, err.message))
          e.error = err
          _this.emit('error', e)
          // XXX emit it to callbacks!
        } else {
          bakeServiceProto(_this.__svcproto, result)
          _this._service.connect(_this.__endpoint)
        }
      }

      function _locatorBeforeError(err){
        debug('function _locatorBeforeError(err){')
        debug('locator._service._state', locator._service._state)
        __assert(_this._resolving, '_this._resolving')
        err.condition = 'locator'
        if(_this.beforeError(err)){
          var hdl = _this._popErrorHandler()
          hdl && _this._callErrorHandler(hdl)
          return true
        }
      }

      function _locatorError(err){
        debug('function _locatorError(err){')
        __assert(_this._resolving, '_this._resolving')
        _this._resolving = false
        var e = new Error(util.format('locator error while resolving service <%s>: %s', _this.__name, err.message))
        e.error = err
        _this.close(e)
        _this.emit('error', e)
      }
    }
    
  },

  _scheduleConnect: function(){
    if(!this._waitingForConnect && !this._resolving){
      this._connectTimer = setTimeout(this._hdl._doConnect, this._connectTimeout)
      this._connectTries++
      this._waitingForConnect = true
      this._connectTimeout <<= 1
    }
  },

  _ensureConnected: function(){
    debug('ensureConnected', this._service._state)
    debug("this._service._state === 'closed' && !this._waitingForConnect && !this._resolving",
          this._service._state === 'closed' && !this._waitingForConnect && !this._resolving)
    if(this._service._state === 'closed' && !this._waitingForConnect && !this._resolving){
      this._waitingForConnect = true
      this._hdl._doConnect()
    }

    return this._service._state === 'connected'
  }
  
}


