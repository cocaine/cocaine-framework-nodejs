
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var defaultMethods = require('./methods/callback')
var service = require('./service')
var makeService = service.makeService

var Logger = require('../client/logger').Logger

var argv = require('optimist').argv

var util = require('../util')

//var Logger = require('./logger').Logger

var debug = require('debug')('co:compat:client')

// var client = new cocaine.Client(locator, methods);

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



function Client(locatorEndpoint, methods){

  debug('Client()', locatorEndpoint, methods)
  
  EventEmitter.call(this)
  this.__methods = methods || defaultMethods
  this._handlers = {}
  this._locatorEndpoint = locatorEndpoint
  this._errorHandler = null
  util.bindHandlers(this.handlers, this._handlers, this)  
  
}

Client.prototype.getServices = function(names, cb){

  debug('getServices', names)

  var _this = this
  var clients = []
  var done = 0, err = null

  names.forEach(function(name, idx){

    if(name === 'logging'){
      var s = _this.Logger(argv.app)
    } else {
      var s = _this.Service(name)
    }

    clients[idx] = s

    // clients.unshift(err)
    // return cb.apply(null, clients)
    
    s.on('connect', _onConnect)
    s.on('error', _onError)

    s.connect()
    
    function _onConnect(){
      debug('_onConnect: service %s connected', name)
      clients[idx].removeListener('connect', _onConnect)
      clients[idx].removeListener('error', _onError)
      done++
      if(done === names.length){
        debug('connected to all requested services', names)
        clients.unshift(err)
        cb.apply(null, clients)
      }
    }
    
    function _onError(err0){
      debug('_onError: service %s connect error', name, err)
      if(err === null){
        err = new Array(names.length)
      }
      err[idx] = err0
      clients[idx].removeListener('connect', _onConnect)
      clients[idx].removeListener('error', _onError)
      done++
      if(done === names.length){
        clients.unshift(err)
        cb.apply(null, clients)
      }
    }
  })

}


Client.prototype.Service = function Service(name, def){
  
  var Service = service.Service(name, def, this.__methods, {
    locator: this._locatorEndpoint
  })
  

  var s = new Service()

  s._client = this
  
  return s
  
}

Client.prototype.Logger = function LoggerFactory(app){

  var log = new Logger(app, {
    locator: this._locatorEndpoint
  })

  log._client = this
  
  return log
  
}

exports.Client = Client


exports.Client.methods = {
  callback: require('./methods/callback'),
  promises: require('./methods/promises'),
  promises_shim: require('./methods/promises_shim'),
  fibers: require('./methods/fibers')
}


