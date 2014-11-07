
var Service = require('../lib/client/resolving').Resolving
var methods = require('../lib/client/services/storage').methods



function smoke(){

  var StorageService = Service.def('storage', {

    locator: {
      endpoint: 'apefront.tst.ape.yandex.net:10053' // specifies locator endpoint 
    }
  })

  var storage = new StorageService({
    maxConnectTries:10, // number of times to retry connect
    
    baseConnectTimeout:200, // initial reconnect interval.
    // with each retry it is increased by the factor of 2

    methods: methods,
    
    locator:{
      // options for locator service client.
      // with each connect of NodeService instance, a new locator
      // instance is created. These options are passed to it's
      // constructor

      // options have same meaning as for NodeService
      maxConnectTries: 4, 
      baseConnectTimeout: 20
    }
  })

  storage.connect() // this is not mandatory, connect will be established
  // automatically on first request

  storage.once('connect', function(){

    setInterval(function(){

      storage.read('manifests', 'patterns_3c1c4092d820e56aff7fb362d4ed9d28178690f9', function(err, keys){
        if(err){
          console.log('error', err)
        } else {
          console.log('read (2):', keys)
        }
      })


    }, 1000)

    storage.call('find', ['manifests', ['app']], function(err, keys){
      if(err){
        console.log('error', err)
      } else {
        console.log('apps found (0):', keys)
      }
    })

  })

  storage.call('read', ['manifests', 'patterns_3c1c4092d820e56aff7fb362d4ed9d28178690f9', ['oijoijsdf']], function(err, keys){
    if(err){
      console.log('error', err)
    } else {
      console.log('read (0):', keys)
    }
  })


  storage.on('error', function(err){
    console.log('fatal storage service error:', err)

    // after `error` is emitted on Storage instance, all pending
    // sessions are going to err out with ECONNRESET

  })


}


smoke()

