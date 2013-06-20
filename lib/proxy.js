
var http = require("http")

var service = require("./service")

var dbg = 0

var Proxy = function(){
  http.Server.apply(this,arguments)
  this._apps = {}
}

Proxy.prototype = {
  __proto__:http.Server.prototype,
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
      dbg && console.log("returning cached app",app)
      return cb(null, this._apps[app])
    }
    dbg && console.log("resolving app",app)
    var self = this
    service.getServices([app],function(App){
      dbg && console.log("resolved app",app)
      var app0 = self._apps[app] = new App()
      cb(null,self._apps[app])
    })
  }
}

module.exports = {
  Proxy:Proxy
}



