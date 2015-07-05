
var __assert = require('assert')
var debug = require('debug')('co:compat:service')

var EventEmitter = require('events').EventEmitter

var Service = require('../client/service').Service

var slice = Array.prototype.slice

var Q = require('q')

var defaultMethodsImpl = require('./methods/callback')


function ServiceFactory(name, def, methods, options){

  debug('ServiceFactory', name, def, methods, options)

  methods = methods || defaultMethodsImpl

  debug('the effective methods are', methods)

  if(typeof def === 'string'){
    debug('def: is a string, loading definition for `%s`', def)
    var definition = loadServiceDefinition(def, methods)
  } else if(typeof def === 'undefined'){
    debug('def: undefined, loading definition by name `%s`', name)
    var definition = loadServiceDefinition(name, methods)
  } else {
    debug('def: should be an object', def)
    __assert(typeof def === 'object' && def !== null, "typeof def === 'object' && def !== null")
    var definition = def
  }

  debug('the effective definition is', definition)

  var binary = !!definition.binary

  function ServiceImpl(){

    this._options = options || {}
    this._sessions = {}
    this._client = null

    this._service = Service(name, {
      binary: binary,
      locator: [this._options.locator] || undefined
    })

    this._onConnectError = this._onConnectError.bind(this)
    this._onServiceError = this._onServiceError.bind(this)
    this._onConnect = this._onConnect.bind(this)
  }

  var proto = ServiceImpl.prototype = {
    __proto__: servicePrototype,

    _name: name,
    __definition: definition,
    __methods: methods,
    __svcproto: undefined
  }
  proto.__svcproto = proto
  
  return ServiceImpl
  
}


var servicePrototype = {
  
  __proto__: EventEmitter.prototype,

  connect: function(){
    this._service.connect()
    this._service.once('connect', this._onConnect)
    this._service.once('error', this._onConnectError)
  },

  close: function(){
    this._service.close()
  },

  _onConnectError: function handleConnectError(err){
    this._service.removeListener('connect', this._onConnect)
    this.emit('error', err)
  },

  _onConnect: function(){
    this._service.removeListener('error', this._onConnectError)
    this._service.on('error', this._onServiceError)
    this._bakeMethods()
  },

  _onServiceError: function(err){
    this._emit('error', err)
  },

  _bakeMethods: function(){

    var mm = this._service._getMethods()

    debug('methods available for service', mm)

    mm.some(function(methodName){
      var M = this._makeMethodImpl(methodName)
      this.__svcproto[methodName] = M
    }, this)

    this.emit('connect')
  },

  _makeMethodImpl: function makeMethodImpl(methodName){

    debug('choosing implementation for', methodName)

    var defaultMethodImpl = this.__definition.defaultMethod
    var methods_def = this.__definition.methods

    debug('defaultMethodImpl', defaultMethodImpl)
    debug('var definition = this.__definition', this.__definition)

    if(methodName in methods_def){
      debug('method %s present in definition', methodName)
      var methodImpl = methods_def[methodName](methodName)
    } else {
      debug('method %s not present in definition, using defaultMethod', methodName)
      var methodImpl = defaultMethodImpl(methodName)
    }

    return methodImpl
    
  }

}


function loadServiceDefinition(name, methods){
  debug('loadServiceDefinition', slice.call(arguments))
  __assert(typeof name === 'string', "typeof name === 'string'")
  var modName = './services/'+name
  try {
    var def = require(modName)
    debug('service definition module loaded', name, def)
    if(typeof def === 'function'){
      return def(methods)
    } else {
      return def
    }
  } catch (e){
    if(e.code === 'MODULE_NOT_FOUND'){
      debug('module '+modName+' not found')
      return {defaultMethod: methods.oneoff, methods:{}}
    } else {
      throw e
    }
  }
}



function makeMethod(name){
  
  function methodImpl(){
    debug('<Service %s>::methodImpl[%s](%s)', this._name, name, arguments)
    
    var args = slice.call(arguments)
    var s = this._service._call(name, args)

    var d = Q.defer()
    
    s.recv({
      value: function(){
        var args = slice.call(arguments)
        d.resolve(args)
      },
      error: function(ec, message){
        var e = new Error(message)
        e.code = ec[1]
        d.reject(e)
      }
    })

    return d.promise
  }

  return methodImpl
}


exports.Service = ServiceFactory

