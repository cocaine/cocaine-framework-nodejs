
var Stateless = require('../lib/client/stateless').Stateless

function smoke(){

  var Locator = Stateless.def('locator', ['10.11.12.13:10053', 1, ['resolve', 'refresh']])


  var locator = new Locator({
    maxConnectTries: 12
  })


  setInterval(function(){
    locator.call('resolve', ['node'], function(err, result){
      console.log(arguments)
    })
  },1000)
}


smoke()

