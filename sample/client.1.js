
var mp = require('msgpack')

var cli = new (require('../lib/client/client').Client)(['apefront.tst.ape.yandex.net', 10053])


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
        return L.debug('storage error', err)
      }
      if(0 < appNames.length){
        console.log("there's something for us:", appNames)
        console.log("so what is %s?", appNames[0])
        S.read('manifests', appNames[0], function(err, result){
          if(err){
            return L.debug('storage error', err)
          }
          console.log(mp.unpack(result))
        })
      }
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
      console.log("connect fail. will we retry?", err[1])
      console.log('tries', maxTries, tries, err[1].code)

      if(maxTries < tries++ || err[1].code === 'EADDRINFO' ){
        cli.emit('error', err[1])
      } else {
        cli.setErrorHandler('retryConnect', [timeout])
        timeout <<= 1
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


