
var mp = require('msgpack')

var cli = new (require('../lib/client/client').Client)('10.11.12.13:10053')

var app = cli.Service('diunko_did_node-js-sample', 'app')

cli.on('error', function(err){
  console.log('client error', err)
})

app.on('error', function(err){
  console.log('app error', err)
})

app.connect()

app.on('connect', function(){
  var s = app.enqueue('http', mp.pack(['GET','/','HTTP/1.0',[],'']))

  console.log(s)

  s.on('data', function(data){
    console.log('reply chunk',data)
    console.log('  which decodes',mp.unpack(data))
  })

  s.on('end', function(){
    console.log('reply done')
  })

  s.on('error', function(err){
    console.log('reply error', err)
  })
  
  
})


