
var argv = require('optimist').argv

var _ = require('./lib/client/client')
exports.Client = _.Client

exports.Worker = require('./lib/worker/worker').Worker

Object.defineProperty(exports,'http',{
  get:function(){return require('./lib/worker/http')}
})

exports.spawnedBy = function(){
  return argv.uuid && argv.app && argv.locator && argv.endpoint
}