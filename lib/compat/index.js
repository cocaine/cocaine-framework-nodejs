

module.exports.Client = require('./client').Client

module.exports.Service = require('./service').Service

var argv = require('optimist').argv

exports.Locator = require('../client/locator').Locator

exports.Worker = require('../worker/worker').Worker

Object.defineProperty(exports,'http',{
  get:function(){return require('../worker/http')}
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

