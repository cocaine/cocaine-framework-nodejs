
var net = require('net')
var argv = require('optimist').argv
var q = require('q')

var co = require('cocaine')

var Worker = new co.Worker(argv)
var server = new co.http.Server()

co.getServices(['logging', 'storage', 'geobase', 'uatraits'], function(log, db, geobase, uatraits){
  
  server.on('request',function(req, res){
    Q.All(_detectAgent(req), _detectRegion)
      .fail(function(error){
        log.debug('detect error', error)
        res.end(error.toString())
      })
      .spread(function(agent, region){
        agent = JSON.stringify(agent, null, 2)
        res.end([
          'agent:',
          agent,
          'region:',
          region
        ].join('\n'))
      })
  })

  log.debug('cocaine worker', uuid, 'starting')

  var handle = Worker.getListenHandle('http')
  server.listen(handle)

  function _detectAgent(req){
    var F = Q.defer()
    var ua = req.headers['user-agent']
    if(ua){
      log.debug('detecting agent', ua)
      return uatraits.detect(ua)
    } else {
      F.resolve('unknown')
    }
    return F.promise
  }
  
  function _detectRegion(req){
    var F = Q.defer()
    var ip = req.headers['x-real-ip']
    if(ip && net.isIPv4(ip)){
      log.debug('detecting region for ip', ip)
      return geobase.region_id(ip)
        .then(function(region_id){
          return geobase.names(region_id)
        })
        .then(function(names){
          return names[0]
        })
    } else {
      F.resolve('unknown')
    }
    return F.promise
  }
  
})


