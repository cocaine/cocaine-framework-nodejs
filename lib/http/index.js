
var _ = require("./server")
var Server = _.Server
var createServer = _.createServer

module.exports={
  Server:Server,
  createServer:createServer
}

patch(require("http"),module.exports)

function patch(module0,patch0){
  var orig={}
  for(var k in patch0){
    module0[k] && (orig[k]=module0[k])
    module0[k] = patch0[k]
  }
  module0.__orig = orig
}

