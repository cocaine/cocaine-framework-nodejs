

var util = require('util')

var Locator = require('../lib/client/locator').Locator


function smoke(){

  var L = new Locator()

  L.connect()

  L.once('connect', function(){
    setInterval(function doResolve(){
      if(L._connected){
        L.resolve('storage', function(err, endpoints, version, graph){
          if(err){
            console.log('resolve error', err)
          } else {
            console.log('endpoint %s, version %s, graph \n %s', util.inspect(endpoints), version, util.inspect(graph, {depth:null}))      
          }
        })
      }
    }, 1000)
  })

  L.on('error', function(err){
    console.log('error', err)
    console.log(new Error().stack)
    setTimeout(function(){
      L.connect()
    },1000)
  })
  
}


smoke()

