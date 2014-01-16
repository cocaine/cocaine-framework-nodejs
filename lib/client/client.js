
exports.Client = Client

var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var methods = require('./methods/callback')
var service = require('./service')
var makeService = service.makeService


var util = require('../util')

var Logger = require('./logger').Logger

var trace = 0

function normalizeEndpoint(endpoint, defaultEndpoint){
  if(!endpoint) return defaultEndpoint
  if(typeof endpoint === 'string' && 0 <= endpoint.indexOf(':')){
    var _ = endpoint.split(':')
    var host = _[0], port = parseInt(_[1])
    return [host, port]
  }
  __assert((typeof endpoint === 'object' && endpoint.length === 2)
           || (typeof endpoint === 'string'),
           "(typeof endpoint === 'object' && endpoint.length === 2) "+
           " || (typeof endpoint === 'string')")
  return endpoint
}


function Client(locatorEndpoint, methods0){
  EventEmitter.call(this)
  this.__methods = methods0 || methods
  this._state = 'closed'
  this._locatorEndpoint = normalizeEndpoint(locatorEndpoint, ['127.0.0.1', 10053])
  this.Locator = makeService('locator', [this._locatorEndpoint, 1, ['resolve', 'refresh']],
                          {defaultMethod: methods.unpacking})
  this.Locator.prototype.connect = service.serviceConnect
  this._locator = new this.Locator()
  this._handlers = {}
  this._requests = {}
  this._errorHandler = null
  util.bindHandlers(this.handlers, this._handlers, this)
}


Client.prototype = {
  __proto__: EventEmitter.prototype,
  Logger: function(app){
    var L = new Logger(app)
    L._client = this
    return L
  },
  Service: function(name, def){
    __assert(typeof name === 'string',
             "typeof name === 'string'")
    var s = new (service.Service(name, def, this.__methods))()
    s._client = this
    return s
  },

  getServices: function(names, cb){

    var _this = this
    var clients = []
    var done = 0, err = null, err0 = []

    names.forEach(function(name, idx){

      var s = _this.Service(name)
      clients[idx] = s
      
      s.on('connect', _onConnect)
      s.on('error', _onError)

      s.connect()
      
      function _onConnect(){
        trace && console.log('onConnect')
        clients[idx].removeListener('connect', _onConnect)
        clients[idx].removeListener('error', _onError)
        done++
        if(done === names.length){
          clients.unshift(err)
          cb.apply(null, clients)
        }
      }
      
      function _onError(err){
        trace && console.log('onError', err)
        err = err0
        clients[idx].removeListener('connect', _onConnect)
        clients[idx].removeListener('error', _onError)
        done++
        if(done === names.length){
          clients.unshift(err)
          cb.apply(null, clients)
        }
      }
    })

  },

  resolve: function(name, cb){
    trace && console.log('>>>> enter resolve')
    if(this._state === 'closed'){
      this.connect()
    }
    __assert(this._state === 'connecting' || this._state === 'connected',
             "this._state === 'connecting' || this._state === 'connected'")
    if(!(name in this._requests)){
      this._requests[name] = [cb]
      if(this._state === 'connected'){
        this._resolve(name)
      }
    } else {
      this._requests[name].push(cb)
    }
    trace && console.log('this._requests', this._requests)
  },

  _resolve: function(name){
    trace && console.log('>>> enter _resolve', new Error('trace:').stack)
    __assert(this._state === 'connected', "this._state === 'connected'")
    var _this = this
    this._locator.resolve(name, function(err, result){
      trace && console.log('arguments, name, _this._requests', arguments, name, _this._requests)
      var rr = _this._requests[name]
      delete _this._requests[name]
      rr.forEach(function(cb){
        cb(err, result)
      })
    })
  },

  connect: function(){
    __assert(this._state === 'closed', "this._state === 'closed'")
    this._state = 'connecting'
    this._locator.connect(this._locator._endpoint)
    this._locator.once('connect', this._handlers.connect)
    this._locator.once('error', this._handlers.connectError)
  },

  close: function(){
    this._close()
    this._resetRequests()
  },

  setErrorHandler: function(handlerName, args){
    __assert(typeof handlerName == 'string' && handlerName in this._handlers,
             "typeof handlerName == 'string' && handlerName in this._handlers")
    __assert(this._errorHandler === null, "this._errorHandler === null")
    this._errorHandler = [handlerName, args || []]
  },

  getErrorHandler: function(){
    var h = this._errorHandler
    this._errorHandler = null
    return h
  },

  handlers: {
    connect: function(){
      this._state = 'connected'
      this._locator.removeListener('error', this._handlers.connectError)
      this._locator.on('error', this._handlers.socketError)

      Object.keys(this._requests).forEach(this._resolve, this)
      this.emit('connect')
    },

    connectError: function(err){
      this._locator.removeListener('connect', this._handlers.connect)
      this.emit('error', ['connect', err])
      var h = this.getErrorHandler() || ['failConnect', [err]]
      this._handlers[h[0]].apply(this, h[1])
    },
    
    _doConnect: function(){
      this.connect()
    },
    
    retryConnect: function(timeout){
      this._close()
      setTimeout(this._handlers._doConnect,timeout)
    },

    failConnect: function(err){
      this._close()
      this._resetRequests(err)
    },

    socketError: function(err){
      this.emit('error', ['socket', err])
      var h = this.getErrorHandler() || ['failConnect', [err]]
      this._handlers[h[0]].apply(this, h[1])
    },

    reconnect: function(timeout){
      this._close()
      this._resetRequests(err)
      setTimeout(this._handlers._doConnect, timeout)
    }
  },

  _close: function(){
    __assert(this._state !== 'closed', "this._state !== 'closed'")
    this._state = 'closed'
    if(this._locator._state !== 'closed'){
      this._locator.close()
    }
  },
  
  _resetRequests: function(err){
    trace && console.log('resetRequests', arguments)
    var rr = this._requests
    this._requests = {}
    for(var name in rr){
      rr[name].forEach(function(cb){
        cb(err)
      })
    }
  }
  
}

