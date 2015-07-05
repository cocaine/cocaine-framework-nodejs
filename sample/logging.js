
var Service = require('../lib/client/service').Service
var locatorEndpoint = ['coke-r04-6-1.haze.yandex.net', 10053]


function smoke(){

  var Logger = require('../lib/client/logger').Logger

  var log = new Logger('some/app/poijpisdf', {locator: locatorEndpoint})
  
  //var log = Service('logging', {locator: locatorEndpoint})

  log.connect()

  log.on('connect', function(){
    console.log('log._connected')
    
    log.emit(0, 'bla', 'blabla', [['aaapoijp-pdsoifjpaosdif', 'bbb']])
    //log.emit(0, 'bla', 'blabla')

    setTimeout(function(){
      console.log('closing')
      log.close()
    }, 1000000)

  })
  
}

smoke()

