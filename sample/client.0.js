

var cli = new (require('../lib/client/client').Client)()


cli.getServices(['node', 'storage'], function(err, node, storage){
  if(err){
    console.log('error resolving some of services', err)
    return 
  }

  node.list(function(err, result){
    if(err){
      console.log('error listing running apps', err)
      return 
    }
    
    console.log('running apps', result)
  })

  storage.find('manifests', ['app'], function(err, result){
    if(err){
      console.log('error listing uploaded apps', err)
      return 
    }

    console.log('uploaded apps', result)
  })
  
})

