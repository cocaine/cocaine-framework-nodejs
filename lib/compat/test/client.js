
var Client = require('cocaine').compat.Client

//var locatorEndpoint = ['coke-r04-6-3.haze.yandex.net', 10053]
var locatorEndpoint = ['coke-r04-6-1.haze.yandex.net', 10053]

var Q = require('q')

var promises = Client.methods.promises_shim.Q(Q)
var methods = Client.methods.promises(promises)

var client = new Client(locatorEndpoint, methods)


//var log = new cocaine.Logger()

client.getServices(['urlfetch', 'logging'], function(err, urlfetch, log){

  if(err){
    console.log('error connecting to some of the services', err)
    return
  }
  
  console.log('connected!')

  log.error({any: 'thing', some: 'place', a: 10}, 'message %s ololo %s',18,47)

  var url = 'http://yastatic.net/encyc/articles_ng/pharma/7/71/paratsetamol.xml';

  var rr = []
  
  for(var i=0;i<100;i++){
    rr[i] = urlfetch.get(url, 2000, {}, {}, true)
  }

  rr.map(function(r,i){
    r.then(function(){
      console.log('done', i)
    })
  })

  var t0 = Date.now(), t1=0

  Q.all(rr)
    .then(function(results){

      results.map(function(result){

        var [ok, data, code, headers] = result
        
        if(!ok){
          //console.log('failed to fetch url %s', url, result)
          return
        }

        //console.log('reply: %s', data)

      })

    })
    .then(function(){
      t1 = Date.now()

      console.log('================================')
      console.log('total time %sms', t1-t0)
      
      //urlfetch.close()
      
    })
    .fail(function(err){
      console.log('fail', err)
      console.log(err.stack)
    })

  urlfetch.on('error', function(err){
    console.log('urlfetch error', err)
  })

  // setInterval(function(){

  //   console.log('================================================================')
  //   console.log('gc run')
  //   console.log(process.memoryUsage())
  //   console.log('----------------------------------------------------------------')
  //   global.gc()
  //   console.log(process.memoryUsage())
  //   console.log('----------------------------------------------------------------')
    
  // }, 10000)
  
  
})



