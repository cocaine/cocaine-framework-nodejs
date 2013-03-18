
var Worker = require("./worker")
var Stream = require("./stream")

module.exports = {
  Server:Worker.Server,
  createServer:Worker.createServer,
  Socket:Stream.Socket
}

var net = require("net")

patch(net,module.exports)

function patch(module0,patch0){
  if(!module0.__cocaine_patched){
    var o={}
    for(fn in patch0){
      o[fn]=module0[fn]
      module0[fn]=patch0[fn]
    }
    module.__orig = o
  }
}


