
var Service = require('../lib/client/service').Service
var mp = require('msgpack')


function smoke(){

  var log = Service('logging')

  log.connect()

  log.on('connect', function(){
    console.log('log._connected', log._connected)
    log.verbosity().recv({
      value: function(verbosity){
        console.log('verbosity', verbosity)
      },
      error: function(){
        console.log('error', arguments)
      }
    })
    log.emit(0, 'bla', 'blabla', {aaa:'bbb'})

    setTimeout(function(){
      console.log('closing')
      log.close()
    }, 1000)

  })
  
}

smoke()

