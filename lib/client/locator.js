
var util = require('util')
var fmt = util.format

var net = require('net')

var EventEmitter = require('events').EventEmitter
var __assert = require('assert')

var debug = require('debug')('co:client:locator')

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

function _normalizeEndpoint(endpoint){
  if(typeof endpoint === 'string'){
    if(endpoint[0] === '['){
      var c = endpoint.lastIndexOf(':')
      var ip6 = endpoint.slice(0,c)
      var port = endpoint.slice(c+1)

      __assert(ip6[ip6.length-1] === ']', fmt("ip6`%s`[ip6.length-1] === ']'", ip6))
      
      ip6 = ip6.slice(1,-1)
      __assert(net.isIPv6(ip6), fmt('net.isIPv6(%s)', ip6))

      port = +port
      __assert(0 < port && port < 65536, fmt('0 < port`%s` && port < 65536', port))

      return [ip6, port]
    } else {

      var c = endpoint.lastIndexOf(':')
      var host = endpoint.slice(0,c)
      var port0 = endpoint.slice(c+1)

      var port = +port0
      __assert(0 < port && port < 65536, fmt('0 < port`%s` && port < 65536', port0))
      
      return [host, port]
    }
  } else if(typeof endpoint === 'object' && endpoint.length === 2){
    var host = endpoint[0]
    var port = endpoint[1]

    __assert(typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536,
             "typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536")

    return endpoint
  }
}

function _normalizeEndpoints(endpoints0, defaultEndpoints){

  var endpoints

  var message =[
    'bad form of endpoints: %s',
    'endpoints should be either Endpoint or [Endpoint+]',
    '  where Endpoint is either "Host:port"',
    '    where Host is one of ipv4, [ipv6], fqdn',
    '  or Endpoint is ["Host", port]',
    '    where Host is one of ipv4, ipv6, fqdn'].join('\n')
  
  if(typeof endpoints0 === 'string') {
    endpoints = [_normalizeEndpoint(endpoints0)]
  } else if(typeof endpoints0 === 'object' && typeof endpoints0.length === 'number') {
    // is it a tuple of endpoints or one endpoint as a pair?
    if(endpoints0.length === 2 && typeof endpoints0[1] === 'number'){
      // assume it's one endpoint in ['host', port] forrm
      endpoints = [_normalizeEndpoint(endpoints0)]
    } else {
      // assume it's a tuple of endpoints
      try {
        endpoints = endpoints0.map(_normalizeEndpoint)
      } catch (e){
        e.message += '\n' + fmt(message, endpoints)
        throw e
      }
    }
  } else {
    throw new TypeError(fmt(message, endpoints0))
  }
  return endpoints
}

function Locator(endpoints){
  if(endpoints){
    endpoints = _normalizeEndpoints(endpoints)
  } else {
    endpoints = [['127.0.0.1', 10053], ['::1', 10053]]
  }
  debug('effective locator endpoints', endpoints)
  var S = this._service = new BaseService()
  S._setGraph(locatorGraph)
  this._endpoints = endpoints
  this._connected = false
}
Locator.normalizeEndpoints = _normalizeEndpoints

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
    debug('resolve(%s)', name)
    __assert(this._connected)
    var self = this
    var x = this._service._call('resolve', [name]).recv({
      value: function(endpoints, version, graph){
        debug('resolve result', endpoints)
        cb(null, endpoints, version, graph)
      },
      error: function(code, message){
        debug('resolve error(%s,%s)', code, message)
        var err = new Error(fmt('error resolving service `%s` at %s: %s',
                          name, self._service._effectivelEndpoint, message))
        if(x._stack){
          err.stack =
            err.stack +
            '\n----------------\n' +
            x._stack
        }
        
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

