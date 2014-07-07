
var mp = require('msgpack')

var cli = new (require('../lib/client/client').Client)(['10.11.12.13', 10053])


var baseTimeout = 500
var timeout = baseTimeout

var maxTries = 8
var tries = 0

cli.on('connect', function(){
  console.log('client connected to Locator, after',tries,'tries')
  timeout = baseTimeout
  tries = 0
})

cli.on('error', function(err){
  if(err.condition === 'connect'){

    console.log('connect fail. will we retry?', err)
    console.log('tries', maxTries, tries, err.code)

    if(maxTries < tries++ || err.code === 'EADDRINFO' ){

      console.log('Still cannot connect. Finally, fail. ')
      
    } else {
      console.log("retryConnect [timeout]", timeout)
      cli.setErrorHandler('retryConnect', [timeout])
      timeout <<= 1
    }
  } else if(err.condition === 'socket'){
    
    console.log('Error on connected socket. All pending locator requests are going to be reset.')
    console.log('Trying to reconnect.')
    

    // 'reconnect' handler will close socket to Locator, reset
    // sessions, and try to connect to locator endpoint again
    
    console.log('reconnect [timeout, err]', timeout, err)
    cli.setErrorHandler('reconnect', [timeout, err])
    
  } else {
    
    console.log('some other client error', err)

    // default handler is 'fail', which resets all pending resolve
    // requests, and resets _locator object to initial state
    
  }
})


var app = cli.Service('diunko_did_test-app', 'app')

var appTimeout = baseTimeout
var appTries = 0

app.on('connect', function(){

  appTimeout = baseTimeout
  appTries = 0

  console.log("connected to app")

  app.info(function(err, result){
    if(err){
      console.log('app.info error', JSON.stringify(err))
      return
    }
    console.log('app.info result', result)
  })
  
})

app.on('error', function(err){
  console.log('app client error', err)
  if(appTries < maxTries
     && (err.code === 'ESHUTDOWN'
         || err.code === 'ECONNREFUSED'
         || err.code === 'EPIPE')){
    console.log('================================================================')
    console.dir(app)
    console.log('----------------------------------------------------------------')
    if(app._state === 'error'){
      console.log('closing error state')
      app.close()
    }
    appTries++
    setTimeout(function(){
      console.log('connecting again')
      app.connect()
    },appTimeout)
    
    appTimeout <<= 1
    
  }
})


app.connect()

setTimeout(function(){console.log('nomnom')}, 100*1000)


