
var Resolving = require('../lib/client/resolving').Resolving

function smoke(){

  var Node = Resolving.def('node', {
    stateless: true,
    locator:{
      endpoint: '10.11.12.13:10053'
    }
  })

  var node = new Node({
    maxConnectTries:1,
    //maxReconnects:0,
    locator:{
      maxConnectTries:10,
      //maxReconnects:0
    }
  })

  node.connect()

  node.on('connect', function(){
    setInterval(function(){
      node.list(function(err, result){
        console.log('==== list result ====', arguments)
      })
    },3000)
  })

  // node.call('list', [], function(err, result){
  //   console.log('==== list result ====', arguments)
  // })

  node.on('beforeError', function(err){

    console.log('================ node beforeError', JSON.stringify(err))
    if(err.condition === 'locator'){
      if(err.code === 'ECONNREFUSED'){
        // retry connect
        this._setErrorHandler(['retry-all-requests'])
        return true
      }
    } else if(err.code === 'ECONNREFUSED'){
      this._setErrorHandler(['retry-connect'])
      return true
    }
  })

  // setInterval(function(){
  //   node.call('list', [], function(err, result){
  //     console.log('==== list result ====', arguments)
  //   })
  // },10000)

}


smoke()

