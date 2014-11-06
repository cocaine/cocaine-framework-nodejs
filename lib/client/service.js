
var __assert = require('assert')
var EventEmitter = require('events').EventEmitter
var util = require('util')

var Locator = require('./locator').Locator
var BaseService = require('./base_service').BaseService

var slice = Array.prototype.slice


function resolve(name, locator, cb){
  __assert(typeof name === 'string' && (arguments.length === 2 || arguments.length === 3))
  if(arguments.length === 2){
    cb = locator
    locator = undefined
  }
  __assert(typeof cb === 'function')
  
  var L = locator || new Locator()
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

function Service(name){

  function ServiceClient(){
    this._name = name
    this._service = new BaseService()
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
    console.log('on socket error', err)
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
      resolve(this._name, function(err, endpoints, version, graph){
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
      })
    }
  },

  close: function(){
    if(this._connected){
      this._connected = false
      this._service.close()
    } else {
      console.log('not connected')
    }
  },

  _setEndpoints: function(endpoints){
    this._endpoints = endpoints
  }
  
  
}



module.exports.Service = Service
//module.exports.getServices = getServices


