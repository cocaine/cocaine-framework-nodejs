
var errno = require('../errno').errno
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var mp = require('msgpack')

var _ = require('../util')
var debug = _.debug('co:Stateless')
var bindHandlers = _.bindHandlers

var util = require('util')

var BaseService = require('./base_service').BaseService

module.exports.Stateless = Stateless
module.exports.Session = Session


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


Stateless.def = function(name, definition){
  __assert(typeof name === 'string')
  var endpoint = definition[0]
  var protover = definition[1]
  var _methods = definition[2]

  if(typeof endpoint === 'string' && endpoint.indexOf(':') !== -1){
    endpoint = endpoint.split(':')
    var host = endpoint[0]
    var port = parseInt(endpoint[1])
    __assert(typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536,
             "typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536")
    endpoint = [host, port]
  }

  __assert(protover === 1, 'protover === 1')

  var methods_ = {}
  _methods.some(function(name, idx){
    methods_[name] = idx
  })

  function StatelessService(){
    Stateless.apply(this, arguments)
  }

  StatelessService.prototype = {
    __proto__: Stateless.prototype,
    __name: name,
    __endpoint: endpoint,
    __methods: methods_
  }

  return StatelessService
}


function Stateless(options){
  
  EventEmitter.call(this)
  
  this._service = new BaseService()

  options = options || {}
  this.options = {__proto__: Stateless.prototype.options}
  Object.keys(options).some(function(k){
    this.options[k] = options[k]
  }, this)

  this._queue = []

  this._connectTimeout = this.options.baseConnectTimeout
  this._connectTries = 0
  this._reconnects = 0
  this._waitingForConnect = false

  this._hdl = {}
  bindHandlers(this.handlers, this._hdl, this)

  this._service.on('error', this._hdl.serviceError)
  this._service.on('connect', this._hdl.serviceConnect)
}


Stateless.prototype = {

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
    var methodId = this.__methods[methodName]
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
      if(this._waitingForConnect){
        this._waitingForConnect = false
        this._service.connect(this.__endpoint)
      }
    }
    
  },

  _ensureConnected: function(){
    debug('ensureConnected', this._service._state)
    if(this._service._state === 'closed' && !this._waitingForConnect){
      this._service.connect(this.__endpoint)
    }

    return this._service._state === 'connected'
  },

  // assumes there's some error condition in `connecting` state
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
  // if allowed, will restart all pending sessions
  _maybeReconnect: function(){
    __assert(this._service._state === 'connected')
    if(this._reconnects++ < this.options.maxReconnects){
      this._hdl.retryAllRequests()
      this._ensureConnected()
      return true
    } else {
      return false
    }
  }
  
}


