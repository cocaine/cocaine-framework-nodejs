
var Resolving = require('../lib/client/resolving').Resolving

function smoke(){

  var Node = Resolving.def('node', {
    locatorEndpoint: '10.11.12.13:10053'
  })

  var node = new Node()
    
  setInterval(function(){
    node.call('list', [], function(err, result){
      console.log(arguments)
    })
  },1000)
}


smoke()

