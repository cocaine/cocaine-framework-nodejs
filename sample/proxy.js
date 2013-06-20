
var co = require("..")

var P = new co.Proxy()

P.listen(function(rq,rs0){
  var chunks = [this.bakeHeader(rq)]
  var se = this.getRoute(rq.url)
  if(!se){
    rs.writeHead(503)
    rs.end("no service found")
  } else {
    this.getApp(se[0],function(err,app){
      if(err){
        rs.writeHead(503)
        rs.end("no service found: "+se[0])
      } else {
        rq.on("data",function(chunk){
          chunks.push(chunk)
        })
        rq.on("end",function(){
          var rs1 = app.invoke(se[1],Buffer.concat(chunks))
          rs1.pipe(rs0)
        })
      }
    })
  }
})



