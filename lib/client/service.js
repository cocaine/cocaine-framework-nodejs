
exports.makeService = makeService
exports.bakeServiceProto = bakeServiceProto,
exports.Service = Service
exports.serviceConnect = serviceConnect


var PROTOCOL_VERSION = 1

var __assert = require('assert')
var isIP = require('net').isIP
var dns = require('dns')

var BaseService = require('./base_service').BaseService

var methods = require('./methods/callback')
var Client = require('./client').Client

var client // = module.exports.client = new Client() // can't do this because
// of cyclic dependency client->service->client, so it's done in
// _resolve of serviceConnect routine

var debug = require('../util').debug('co:service')


var slice = Array.prototype.slice

function makeService(name, result, def){
  
  var proto = bakeServiceProto(name, result, def)
  proto.connect = serviceConnect
  proto.__proto__ = BaseService.prototype

  Client.prototype = proto
  
  return Client
  
  function Client(){
    BaseService.apply(this, arguments)
  }
  
}

function loadServiceDefinition(name, methods){
  debug('loadServiceDefinition', slice.call(arguments))
  __assert(typeof name === 'string', "typeof name === 'string'")
  var modName = './services/'+name
  try {
    var def = require(modName)
    debug('loaded service definition', name, def)
    if(typeof def === 'function'){
      return def(methods)
    } else {
      return def
    }
  } catch (e){
    if(e.code === 'MODULE_NOT_FOUND'){
      debug('module '+modName+' not found')
      return {defaultMethod: methods.unpacking}
    } else {
      throw e
    }
  }
}

function bakeServiceProto(name, result, def, proto){

  debug('>>> bakeServiceProto:', arguments)
  
  var endpoint = result[0]
  var protocolVer = result[1]
  var methods = result[2]

  __assert(protocolVer === PROTOCOL_VERSION,
           'protocolVer === PROTOCOL_VERSION')

  proto = proto || {}
  proto._name = name
  proto._endpoint = endpoint
  
  for(var mid in methods){
    var _
    var methodName = methods[mid]
    mid = parseInt(mid)
    var M = ((_ = def.methods) && _[methodName]) || def.defaultMethod
    proto[methodName] = M(mid, methodName)
  }

  proto.__svcproto && (proto.__svcproto = undefined)
  
  return proto
}


function Service(name, def, methods0){
  debug('Service', slice.call(arguments))
  
  if(typeof def === 'string'){
    debug('definition: string', def)
    def = loadServiceDefinition(def, methods0 || methods)
  } else if(typeof def === 'undefined'){
    debug('definition: undefined')
    def = loadServiceDefinition(name, methods0 || methods)
  } else {
    debug('definition: object', def)
    __assert(typeof def === 'object', "typeof def === 'object'")
    //def = loadServiceDefinition(name, methods0 || methods)
  }

  function Service(){
    BaseService.apply(this, arguments)
    this._lookingup = false
    this._client = null
    this.__definition = def
  }

  var proto = Service.prototype = {
    __proto__: BaseService.prototype,
    __svcproto: undefined,
    _name: name,
    connect: serviceResolveConnect
  }

  proto.__svcproto = proto
  
  return Service
  
}

var baseServiceConnect = BaseService.prototype.connect

function serviceConnect(){
  var _this = this
  var done = false
  
  if(this._lookingup) return
  this._lookingup = true

  __assert(this._endpoint, 'this._endpoint')
  _checkIP()

  function _checkIP(){
    debug('_checkIP', _this._endpoint)
    if(Array.isArray(_this._endpoint) && !isIP(_this._endpoint[0])){
      debug('not ip:', _this._endpoint[0])
      dns.lookup(_this._endpoint[0], _lookupDone)
    } else {
      _connect()
    }
  }

  function _lookupDone(err, address, family){
    debug('_lookupDone', arguments)
    if(err) return _handleError(err)
    _this._endpoint[0] = address
    _connect()
  }

  function _handleError(err){
    debug('_handleError', arguments)
    if(!done){
      done = true
      this._lookingup = false
      _this.emit('error', err)
    } else {
      debug('_handleError called after done', arguments)
    }
  }
  
  function _connect(){
    debug('_connect')
    if(!done){
      done = true
      _this._lookingup = false
      baseServiceConnect.call(_this, _this._endpoint)
    } else {
      debug('_connect called after done')
    }
  }
}

function serviceResolveConnect(){
  var _this = this
  var done = false
  
  if(this._lookingup) return
  this._lookingup = true
  
  _resolve()

  function _resolve(){
    debug('_resolve', _this._name, _this._endpoint)
    if(!_this._client && client === undefined){
      client = new Client()
    }
    (_this._client || client).resolve(_this._name, _resolveDone)
  }

  function _resolveDone(err, result){
    debug('_resolveDone', arguments)
    debug('svcproto',_this.__svcproto)
    if(err) return _handleError(err)
    var p = bakeServiceProto(_this._name, result,
                          _this.__definition,
                          _this.__svcproto || _this.__proto__)
    debug('baked proto', p)
    _checkIP()
  }

  function _checkIP(){
    debug('_checkIP', _this._endpoint)
    if(Array.isArray(_this._endpoint) && !isIP(_this._endpoint[0])){
      debug('not ip:', _this._endpoint[0])
      dns.lookup(_this._endpoint[0], _lookupDone)
    } else {
      _connect()
    }
  }

  function _lookupDone(err, address, family){
    debug('_lookupDone', arguments)
    if(err) return _handleError(err)
    _this._endpoint[0] = address
    _connect()
  }

  function _handleError(err){
    debug('_handleError', arguments)
    if(!done){
      done = true
      this._lookingup = false
      _this.emit('error', err)
    } else {
      debug('_handleError called after done', arguments)
    }
  }
  
  function _connect(){
    debug('_connect')
    if(!done){
      done = true
      _this._lookingup = false
      baseServiceConnect.call(_this, _this._endpoint)
    } else {
      debug('_connect called after done')
    }
  }
}


