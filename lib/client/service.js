
var __assert = require('assert')
var EventEmitter = require('events').EventEmitter
var util = require('util')
var fmt = util.format

var Locator = require('./locator').Locator
var BaseService = require('./base_service').BaseService
var debug = require('debug')('co:client:service')

var slice = Array.prototype.slice


function resolve(name, locator, cb) {
  __assert(typeof name === 'string' && (arguments.length === 2 || arguments.length === 3))
  if(arguments.length === 2) {
    cb = locator
    locator = undefined
  }
  __assert(typeof cb === 'function')

  if(locator instanceof Locator) {
    var L = locator
  } else {
    if(locator){
      var endpoints = Locator.normalizeEndpoints(locator)
      var L = new Locator(endpoints)
    } else {
      var L = new Locator()
    }
  }
  
  var done = false

  L.connect()

  L.once('connect', _onConnect)
  function _onConnect(){
    L.resolve(name, function(err, endpoints, version, graph){
      L.removeListener('error', _onError)
      L.close()
      if(!done){
        done = true
        if(err){
          cb(err)
        } else {
          cb(null, endpoints, version, graph)
        }
      }
    })
  }

  L.on('error', _onError)
  function _onError(err){
    L.removeListener('error', _onError)
    L.removeListener('connect', _onConnect)
    L.close()
    if(!done){
      cb(err)
    }
  }
}

function bakeMethods(service, graph){
  var __methods = service.__methods

  Object.keys(graph).some(function(k){
    var methodName = graph[k][0]
    __methods[methodName] = function(){
      var args = slice.apply(arguments)
      return this._service._call(methodName, args)
    }
  })
  
}

function Service(name, options){

  debug('constructing service %s with options %s', name, options)

  function ServiceClient(){
    this._name = name
    this._options = options || {}
    this._service = new BaseService({binary: this._options.binary})
    debug('using binary decoding', this._options.binary)
    this._onSocketError = this._onSocketError.bind(this)
    this._connected = false
    this._connecting = false
  }

  var methods = ServiceClient.prototype = {
    __proto__: serviceClientPrototype,
    __methods: null
  }

  methods.__methods = methods

  return new ServiceClient()
  
}


var serviceClientPrototype = {
  __proto__: EventEmitter.prototype,

  _onSocketError: function(err){
    debug('on socket error', err)
    __assert(this._connected)
    this._connected = false
    this._service.close()
    this._emit('error', err)
  },
  
  _emit: EventEmitter.prototype.emit,

  connect: function(){
    if(!this._connecting && !this._connected){
      this._connecting = true

      var self = this
      if(this._options.locator){
        debug('resolving with specified locator', this._options.locator)
        resolve(this._name, this._options.locator, _onResolve)
      } else {
        debug('resolving with default locator')
        resolve(this._name, _onResolve)
      }
      
      function _onResolve(err, endpoints, version, graph){
        if(err){
          self._emit('error', err)
        } else {
          self.__graph = graph
          self._service._setGraph(graph)
          
          bakeMethods(self, graph)

          self._setEndpoints(endpoints)
          self._service.connect(self._endpoints)
          self._service.on('connect', _onConnect)
          self._service.on('error', _onConnectError)

          function _onConnect(){
            self._service.removeListener('connect', _onConnect)
            self._service.removeListener('error', _onConnectError)
            self._service.on('error', self._onSocketError)
            self._connecting = false
            self._connected = true
            self._emit('connect')
          }

          function _onConnectError(err){
            self._service.removeListener('connect', _onConnect)
            self._service.removeListener('error', _onConnectError)
            self._service.close()
            self._connecting = false
            self._emit('error', err)
          }
        }
      }
    }
  },

  _call: function(){
    __assert(this._connected)

    return this._service._call.apply(this._service, arguments)
    
  },

  close: function(){
    if(this._connected){
      this._connected = false
      this._service.close()
    } else {
      debug('not connected')
    }
  },

  _setEndpoints: function(endpoints){
    this._endpoints = endpoints
  },

  _getMethods: function(){
    __assert(this._connected)

    var graph = this.__graph

    return Object.keys(graph).map(function(k){
      return graph[k][0]
    })

  }
  
  
}



module.exports.Service = Service


