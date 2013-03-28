
var Worker = require("./worker")
var Stream = require("./stream")

module.exports = {
  Server:Worker.Server,
  createServer:Worker.createServer,
}

patch(require("net"),module.exports)

function patch(module0,patch0){
  if(!module0.__cocaine_patched){
    var orig={}
    for(var fn in patch0){
      module0[fn] && (orig[fn]=module0[fn])
      module0[fn]=patch0[fn]
    }
    module.__orig = orig
  }
}


