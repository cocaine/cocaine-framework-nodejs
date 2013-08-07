#!/usr/bin/env node

var co = require('..')

var dbg0 = 0, dbg = 0

var i = 0
var closing = false

var P = new co.Proxy(function(rq,rs0){
  var chunks = [this.bakeHeader(rq)]
  var se = this.getRoute(rq.url)
  if(!se){
    rs0.writeHead(503)
    rs0.end('no service found')
    dbg && console.log('EEEE')
  } else {
    dbg && console.log('should keep alive:',rs0.shouldKeepAlive)
    dbg && console.log('chunkedEncoding',rs0.useChunkedEncodingByDefault)
    this.getApp(se[0],function(err,app){
      if(err){
        rs0.writeHead(503)
        rs0.end('no service found: '+se[0])
      } else {
        rq.on('data',function(chunk){
          chunks.push(chunk)
        })
        rq.on('end',function(){
          var rs1 = app.enqueue(se[1],Buffer.concat(chunks))
          P.downgradeResponse(rs0)
          rs1.pipe(rs0)
          if(closing){
            rs0._last = true
          }
        })
      }
    })
  }
})

P.listen(8181)

process.title = 'node-cocaine-proxy'

process.on('SIGTERM', function () {
  console.log('Closing');
  closing = true
  P.close(function(){
    console.log('closed')
    process.exit(0)
  });
});


