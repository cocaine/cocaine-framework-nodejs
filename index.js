
var argv = require('optimist').argv

exports.Service = require('./lib/client/service').Service

exports.Locator = require('./lib/client/locator').Locator

exports.Worker = require('./lib/worker/worker').Worker

Object.defineProperty(exports,'http',{
  get:function(){return require('./lib/worker/http')}
})

exports.spawnedBy = function(){
  return argv.uuid && argv.app && argv.locator && argv.endpoint
}

exports.getWorkerAttrs = function(){
  return {
    uuid: argv.uuid,
    app: argv.app,
    locator: argv.locator,
    endpoint: argv.endpoint
  }
}

exports.compat = require('./lib/compat')
