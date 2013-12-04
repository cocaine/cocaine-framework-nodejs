
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

L.once('connect', doSomething)
S.once('connect', doSomething)

L.connect()
S.connect()

var i = 0

function doSomething(){
  i++
  console.log('something done', i)
  if(i === 2){
    L.debug("so what's in store?")
    console.log("so what's in store?")
    S.find('manifests', ['app'], function(err, appNames){
      if(err){
        L.debug('storage error', err)
        return err
      }
      L.debug("there's something for us:", appNames)
      console.log("there's something for us:", appNames)
    })
  }
}



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


