

var cli = new (require('../lib/client').Client)()


cli.resolve('node', function(err, result){
  console.log('resolve done:', result)
})

var baseTimeout = 500
var timeout = baseTimeout

var maxTries = 8
var tries = 0

var L = cli.Logger('testtest')
var S = cli.Service('storage')



function doSomething



cli.on('connect', function(){
  timeout = baseTimeout
  tries = 0
})

cli.on('error', function(err){
  if(Array.isArray(err)){
    if(err[0] === 'connect'){
      console.log("connect fail. will we retry?")
      if(tries++ < maxTries){
        cli.setErrorHandler('retryConnect', [timeout])
        timeout <<= 1
      } else {
        cli.emit('error', err[1])
      }
    } else if(err[0] === 'socket'){
      console.log("fail on connected socket. will we reconnect?")
      if(tries++ < maxTries){
        timeout <<= 1
        cli.setErrorHandler('reconnect', [timeout])
      } else {
        cli.emit('error', err[1])
      }
    }
  }
})

