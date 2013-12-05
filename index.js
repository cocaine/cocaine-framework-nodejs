
var _ = require('./lib/client/client')
exports.Client = _.Client

exports.Worker = require('./lib/worker/worker').Worker

Object.defineProperty(exports,'http',{
  get:function(){return require('./lib/worker/http')}
})

