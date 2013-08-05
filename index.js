
var _ = require('./lib/service')
exports.Service = _.Service
exports.getServices = _.getServices

exports.Worker = require('./lib/worker').Worker
exports.Proxy = require('./lib/proxy').Proxy

