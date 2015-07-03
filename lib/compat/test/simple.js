
var Client = require('cocaine').compat.Client

//var locatorEndpoint = ['coke-r04-6-3.haze.yandex.net', 10053]
//var locatorEndpoint = ['coke-r04-6-1.haze.yandex.net', 10053]
var locatorEndpoint = ['cocs01h.tst12.ape.yandex.net', 10053]


var Q = require('q')

var promises = Client.methods.promises_shim.Q(Q)
var methods = Client.methods.promises(promises)

var client = new Client(locatorEndpoint, methods)


//var log = new cocaine.Logger()


var urlfetch = client.Service('urlfetch')


urlfetch.connect()

urlfetch.on('connect', function(){

  console.log('connected!')

  var url = 'http://yastatic.net/encyc/articles_ng/pharma/7/71/paratsetamol.xml';

  var rr = []
  
  for(var i=0;i<10;i++){
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
      
      urlfetch.close()
      
    })
    .fail(function(err){
      console.log('fail', err)
      console.log(err.stack)
    })
    
})

urlfetch.on('error', function(err){
  console.log('urlfetch error', err)
})

0 && setInterval(function(){

  console.log('================================================================')
  console.log('gc run')
  console.log(process.memoryUsage())
  console.log('----------------------------------------------------------------')
  global.gc()
  console.log(process.memoryUsage())
  console.log('----------------------------------------------------------------')
  
}, 10000)

