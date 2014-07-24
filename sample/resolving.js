
var Service = require('../lib/client/resolving').Resolving

function smoke(){

  var NodeService = Service.def('node', {
    
    stateless: true, // this flag specifies that the service is 'stateless'
    // i.e. that all it's methods don't cause side-effects
    // (strictly speaking, with `node` service this is true only for `info` method)
    // given this flag, it is assumed that all requests are safe to retry
    // as long as reconnect policy permits

    locator: {
      endpoint: '10.11.12.13:10053' // specifies locator endpoint 
    }
  })

  var node = new NodeService({
    maxConnectTries:10, // number of times to retry connect
    
    baseConnectTimeout:200, // initial reconnect interval.
    // with each retry it is increased by the factor of 2

    
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

  node.connect() // this is not mandatory, connect will be established
  // automatically on first request

  node.on('connect', function(){

    setInterval(function(){
      node.list(function(err, result){
        console.log('list() result', arguments)
      })
    },3000)
  })


  // until we are yet not connected, we can 
  // call `list` method of `node` service via a generic `call`
  // interface.
  // it's signature is `service.call(methodNamd, args, callback)`
  node.call('list', [], function(err, result){
    console.log('call(`list`) result:', arguments)
  })


  node.on('error', function(err){
    console.log('node service error:', err)

    // after `error` is emitted on NodeService instance, all pending
    // sessions are going to err out

  })


}


smoke()

