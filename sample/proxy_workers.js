
var cluster = require('cluster');
var co = require('..')
var numCPUs = 3 //require('os').cpus().length;

var dbg = 0

if (cluster.isMaster) {
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', function(worker, code, signal) {
    console.log('worker ' + worker.process.pid + ' died');
  });
} else {
  
  var P = new co.Proxy(function(rq,rs0){
    dbg && console.log('rq.url',rq.url)
    var chunks = [this.bakeHeader(rq)]
    var se = this.getRoute(rq.url)
    if(!se){
      rs0.writeHead(503)
      rs0.end('no service found')
    } else {
      this.getApp(se[0],function(err,app){
        dbg && console.log('err,app:',err,app)
        if(err){
          rs0.writeHead(503)
          rs0.end('no service found: '+se[0])
        } else {
          rq.on('data',function(chunk){
            chunks.push(chunk)
          })
          rq.on('end',function(){
            var rs1 = app.invoke(se[1],Buffer.concat(chunks))
            rs1.pipe(rs0)
          })
        }
      })
    }
  })

  P.listen(8181)
}






