
var Q = require('q')

var Client = require('../lib/client/client').Client

var promises = Client.methods.promises_shim.Q(Q)
var methods = Client.methods.promises(promises)

var cli = new Client(null, methods)

var mp = require('msgpack')

cli.getServices(['node', 'storage'], function(err, node, storage){
//cli.getServices(['node'], function(err, node){
  if(err){
    console.log('error resolving some of services', err)
    return 
  }


  storage.find('manifests', ['app'])
    .then(function(apps){
      console.log('---- uploaded apps:\n', apps)
      return Q.all(apps.map(function(app){
        return storage.read('manifests', app)
          .then(function(manifest){
            console.log('<app/%s>:',app, mp.unpack(manifest))
          })
      }))
    })
    .fail(function(err){
      console.log('error listing uploaded apps', err)})
    .then(function(){
      node.list()
        .then(function(result){
          console.log('---- running apps:\n', result)})
        .fail(function(err){
          console.log('error listing running apps', err)})
    })
  
  
})


cli.on('error', function(err){
  console.log('client error', err)
})


