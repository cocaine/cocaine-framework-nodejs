
var Fiber = require('fibers')

var Client = require('../lib/client/client').Client

var methods = Client.methods.fibers(Fiber)

var cli = new Client(null, methods)

var mp = require('msgpack')


var slice = Array.prototype.slice

////////////////
// preamble

Fiber(function(){

  var fiber = Fiber.current
  
  cli.getServices(['node', 'storage'], function(){
    fiber.run(slice.call(arguments))
  })

  cli.on('error', function(err){
    console.log('client error', err)
  })

  var services = Fiber.yield()

  var err = services.shift()
  if(err){
    console.log('error resolving some of services', err)
    return 
  }

  var node = services[0], storage = services[1]

  try{

// preamble end
////////////////


    ////////////////
    // application code that works with synchronous services

    var apps = storage.find('manifests', ['app'])
    console.log('---- uploaded apps:\n', apps)
    apps.forEach(function(app){
      var manifest = storage.read('manifests', app)
      console.log('<app/%s>:',app, mp.unpack(manifest))
    })

    var running_apps = node.list()
    console.log('---- running apps:\n', running_apps)
    
    // app code end
    ////////////////



////////////////
// epilogue

  } catch(err) {
    console.log('error:', err)
  }
  
}).run()

// epilogue end
////////////////



