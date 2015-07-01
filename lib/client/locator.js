
var util = require('util')
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var BaseService = require('./base_service').BaseService

var locatorGraph = {
  0: ['resolve', {}, {
    0: ['value', {}],
    1: ['error', {}],}],
  1: ['connect', {}, {
    0: ['write', null],
    1: ['error', {}],
    2: ['close', {}]}],
  2: ['refresh', {}, {
    0: ['value', null],
    1: ['error', {}]}],
  3: ['cluster', {}, {
    0: ['write', null],
    1: ['error', {}],
    2: ['close', {}]}]}

function Locator(endpoints){
  endpoints = endpoints || [['127.0.0.1', 10053], ['::1', 10053]]
  __assert(typeof endpoints === 'object' && typeof endpoints.length === 'number',
           "typeof endpoints === 'object' && typeof endpoints.length === 'number'")
  var S = this._service = new BaseService()
  S._setGraph(locatorGraph)
  this._endpoints = endpoints
  this._connected = false
}

Locator.prototype = {
  __proto__: EventEmitter.prototype,
  connect: function(){
    var self = this
    this._service.connect(this._endpoints)
    this._service.on('connect', _onConnect)
    this._service.on('error', _onError)

    function _onConnect(){
      self._connected = true
      self._service.removeListener('connect', _onConnect)
      self._service.removeListener('error', _onError)
      self.emit('connect')
    }

    function _onError(err){
      self._connected = false
      self._service.removeListener('connect', _onConnect)
      self._service.removeListener('error', _onError)
      self._service.close()
      self.emit('error', err)
    }
  },
  resolve: function(name, cb){
    __assert(this._connected)
    this._service._call('resolve', [name]).recv({
      value: function(endpoints, version, graph){
        cb(null, endpoints, version, graph)
      },
      error: function(code, message){
        var err = new Error(message)
        if(message === 'service is not available'){
          err.code = 'ENOTFOUND'
        }
        err.errno = code
        cb(err)
      }
    })
  },
  close: function(){
    if(this._connected){
      this._connected = false
      this._service.close()
    }
  }
}

module.exports.Locator = Locator

