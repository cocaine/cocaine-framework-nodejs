
var mp = require('msgpack')

var cli = new (require('../lib/client/client').Client)(['localhost', 10053])


var baseTimeout = 500
var timeout = baseTimeout

var maxTries = 2
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


var S = cli.Service('storage')

S.once('connect', function(){
  console.log("so what's in store?")
  
  S.find('manifests', ['app'], function(err, appNames){
    if(err){
      console.log('storage error', err)
      return
    }
    if(0 < appNames.length){
      console.log("there's something for us:", appNames)
      console.log('so what is %s?', appNames[0])
      S.read('manifests', appNames[0], function(err, result){
        if(err){
          console.log(L.debug('storage error', err))
          return
        }
        
        console.log('and result is', mp.unpack(result))

        S.close()
        cli.close()
      })
    } else {
      console.log("there's nothing")
    }
  })
})

S.connect()

S.on('error', function(err){
  console.log('storage error', err)
})


//setTimeout(function(){console.log('nomnom')}, 100*1000)


