
var argv = require("optimist").argv
var cocaine = require("cocaine").compat

var worker = new cocaine.Worker(argv)
var handle = worker.getListenHandle("http")
var http = cocaine.http // monkey-patches http, so should be done
// before require("express")

var app = require('express')()
var format = require('util').format
var server = http.createServer(app)

app.get('/linger', function(req, res){
  var t = parseInt(req.query.t)
  var len = 0
  req.on("data", function(chunk){
    len += chunk.length
  })
  req.on("end", function(){
    if(t){
      var h = res.cocaineLingeringShutdown()
      setTimeout(function(){
        h.close()
      }, t)
    }

    var m = format('got body of length %s. lingering...\n', len)
    res.end(m)
  })
})

server.listen(handle, function(){
  console.log('listening on cocaine handle')
})

