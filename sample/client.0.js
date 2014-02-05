
var hostname = require('os').hostname()
var format = require('util').format
var cli = new (require('../lib/client/client').Client)(['localhost', 10053])


cli.getServices(['logging', 'node', 'storage'], function(err, log, node, storage){
  if(err){
    throw new Error(format('error resolving some of services, %j', err))
  }

  log.setAppName(format('client/%s.%s',hostname,process.pid))

  log.debug('connected to services')

  node.list(function(err, result){
    if(err){
      log.debug('error listing running apps', err)
      return 
    }
    
    log.debug('running apps', result)
  })

  storage.find('manifests', ['app'], function(err, result){
    if(err){
      log.debug('error listing uploaded apps', err)
      return 
    }

    log.debug('uploaded apps', result)
  })
  
})

