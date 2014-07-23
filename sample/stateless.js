
var Stateless = require('../lib/client/stateless').Stateless
var Locator = require('../lib/client/locator').Locator


function smoke(){

  //var Locator = Stateless.def('locator', ['10.11.12.13:10053', 1, ['resolve', 'refresh']])


  var locator = new Locator({
    endpoint: '10.11.12.13:10053',
    maxConnectTries: 10
  })

  locator.on('beforeError', function(err){
    console.log('================', JSON.stringify(err))
    if(err.code === 'ECONNREFUSED'){
      this._setErrorHandler(['retry-connect', err])
      return true
    }
  })


  locator.resolve('nodeasodifj', function(err, result){
    if(err){
      console.log('err.message', err.message)
    }
    console.log('resolve done', arguments)
  })

  setInterval(function(){
    locator.call('resolve', ['node'], function(err, result){
      console.log(arguments)
    })
  },10000)
}


smoke()

