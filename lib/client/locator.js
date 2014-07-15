
var __assert = require('assert')

var Stateless = require('./stateless').Stateless

var LocatorBase = Stateless.def('locator', ['localhost:10053', 1, ['resolve', 'refresh']])


function Locator(options){
  LocatorBase.apply(this, arguments)
  if(options && options.endpoint){
    var endpoint = options.endpoint
    if(typeof endpoint === 'string' && endpoint.indexOf(':') !== -1){
      endpoint = endpoint.split(':')
      var host = endpoint[0]
      var port = parseInt(endpoint[1])
      __assert(typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536,
               "typeof host === 'string' && typeof port === 'number' && 0 < port && port < 65536")
      endpoint = [host, port]
    }
    
    this.__endpoint = endpoint
  }
}


Locator.prototype = {
  __proto__: LocatorBase.prototype,

  resolve: function(name, cb){
    this.call('resolve', [name, cb])
  }
}

module.exports.Locator = Locator
