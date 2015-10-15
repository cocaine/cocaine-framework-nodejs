
var Client = require('cocaine').compat.Client

//var locatorEndpoint = ['coke-r04-6-3.haze.yandex.net', 10053]
//var locatorEndpoint = ['coke-r04-6-1.haze.yandex.net', 10053]
var locatorEndpoint = ['localhost', 10053]

var Q = require('q')

var mp = require('msgpack-bin')

// var promises = Client.methods.promises_shim.Q(Q)
// var methods = Client.methods.promises(promises)

var methods = Client.methods.callback

//var client = new Client(locatorEndpoint, methods)
var client = new Client(locatorEndpoint)


//var log = new cocaine.Logger()

var APPNAME = 'myapp'

var app = client.Service(APPNAME, 'oneoff')

app.connect()

app.on('connect', function(){

  console.log('connected!')

  var s = app.enqueue('alive', '{}', function(){
    
    console.log(arguments)
    
  })

  // app.enqueue('alive', '{}', function(){
  //   console.log(arguments)
  // })

})

app.on('error', function(err){
  console.log('socket error', err)
})



