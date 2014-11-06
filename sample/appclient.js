
var mp = require('msgpack')

var Service = require('../lib/client/service').Service


var app = Service('test')

app.connect()


app.on('connect', function(){
  var rq = app.enqueue('http')

  rq.send.write(mp.pack(['GET','/','HTTP/1.0',[['some-header','value']],'']))

  rq.recv({
    write: function(data){
      console.log('data', data)
    },
    error: function(code, message){
      console.log('error<%s,%s>', code, message)
    },
    close: function(){
      console.log('close')
    }
  })

})

app.on('error', function(err){
  console.log('client<test> error', err)
})

