

var Logger = require('../lib/logger').Logger

var L = new Logger('testtest')

L.connect()

L.once('connect', startLogging)

var i=0

function startLogging(){
  setInterval(function(){
    L.debug('testmessage ',i++)
  },1000)
}

L.on('error', function(err){
  console.log('================')
  console.log(arguments)
  L.close()
  setTimeout(function(){
    L.connect()
  },100)
})


