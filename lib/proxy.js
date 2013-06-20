
var http = require("http")

var Service = require("./service").Service

var Proxy = function(){
  http.Server.apply(this,arguments)
  this._apps = {}
}

Proxy.prototype = {
  addXF:function(rq){
    var xf = rq.headers["x-forwarded-for"]
    rq.headers["x-forwarded-for"] =
      (xf?(xf + ", "):" ")+
      rq.socket.remoteAddress || rq.connection.remoteAddress
    var xp = rq.headers["x-forwarded-port"]
    rq.headers["x-forwarded-port"] =
      ((xp ? (xf + ", ") : " ")+
       rq.socket.remotePort || rq.connection.remotePort)
  },
  bakeHeader:function(rq){
    this.addXF(rq)
    var hh = [[rq.method,rq.url,"HTTP/"+rq.httpVersion].join(" ")]
    for(var k in rq.headers){
      hh.push(k+": "+rq.headers[k])
    }
    hh.push("\r\n")
    return Buffer(hh.join("\r\n"))
  },
  getRoute:function(url){
    var m = /^\/(.*?)\/(.*?)\//.exec(url)
    return m && [m[1],m[2]]
  },
  getApp:function(app,cb){
    if(this._apps[app]){
      return cb(null, app)
    }
    var S = Service(app)
    S.resolve()
      .then(
        function(){
          var app this._apps[app] = new S()
          cb(null,app)},
        function(err){
          cb(err)
        })
  }
}

module.exports = {
  Proxy:Proxy
}



