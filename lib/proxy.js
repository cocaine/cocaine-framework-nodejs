
var http = require('http')
var net = require('net')
var dns = require('dns')
var Q = require('q')

var service = require('./service')
var __assert = require('assert')

var Locator = service.Locator
var Service = service.Service

var dbg = 0

function responseEnd(data,encoding){
  if(data){
    var ret = this.write(data,encoding)
  }
  if(this.output.length === 0 && this.connection){
    this._finish()
  }
  return ret
}

var Proxy = function(){
  http.Server.apply(this,arguments)
  this._apps = {}
}

Proxy.prototype = {
  __proto__:http.Server.prototype,
  addXHeaders:function(rq){
    var xip = rq.headers['x-real-ip']
    if(!xip){
      rq.headers['x-real-ip'] = (rq.socket.remoteAddress || rq.connection.remoteAddress);
    }
    var xp = rq.headers['x-real-port']
    if(!xp){
      rq.headers['x-real-port'] = (rq.socket.remotePort || rq.connection.remotePort)
    }
  },
  bakeHeader:function(rq){
    this.addXHeaders(rq)
    var hh = [[rq.method,rq.url,'HTTP/'+rq.httpVersion].join(' ')]
    for(var k in rq.headers){
      hh.push(k+': '+rq.headers[k])
    }
    hh.push('\r\n')
    return Buffer(hh.join('\r\n'))
  },
  downgradeResponse:function(rs){
    rs.write = rs._writeRaw
    rs.end = responseEnd
  },
  getRoute:function(url){
    var m = /^\/(.*?)\/(.*?)\//.exec(url)
    return m && [m[1],m[2]]
  },
  getApp:function(app,cb){
    var _this = this
    if(this._apps[app]){
      dbg && console.log('returning cached app',app)
      return cb(null, this._apps[app])
    }
    dbg && console.log('resolving app',app)
    if(!Locator._handle){
      return cb(new Error('no connection to cloud'))
    }
    var self = this
    Locator.resolve(app)
      .then(function(result){
        var endpoint = result[0]
        __assert(Array.isArray(endpoint))
        if(net.isIPv4(endpoint[0])){
          return result
        } else {
          var f = Q.defer()
          dns.lookup(endpoint[0],4,function(err, address, family){
            dbg && console.log('got ipv4 address:',address)
            if(err) return f.reject(err)
            endpoint[0] = address
            f.resolve(result)
          })
          return f.promise
        }
      })
      .then(function(result){
        var App = Service(app)
        App.resolve(result)
        dbg && console.log('table for app',app,result)
        try{
          var A = new App()
        } catch (e){
          return cb(e)
        }
        _this._apps[app] = A
        dbg && console.log('resolved app',app)
        A.on('error',function(){
          console.log('app error',arguments)
          delete self._apps[app]
        })
        cb(null,A)
      })
      .fail(function(error){
        dbg && console.log('error',error)
        cb(error)
      })
  }
}

Locator.on('error',function(err){
  if(Locator._handle){
    console.log('closed, connecting...')
    Locator.close()
  }
  Locator.connect()
})

module.exports = {
  Proxy:Proxy
}



