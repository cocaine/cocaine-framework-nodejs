
var inspect = require('util').inspect
var __assert = require('assert')

var Q = require('q')
var mp = require('msgpack')
var dns = require('dns')
var net = require('net')

var dbg = 0

var Client = require('./client').Client

var _Service = {
  __proto__:Function.prototype,
  resolve:function(result){
    if(result){
      Service._bake(this,result)
    } else {
      var self = this
      return L.resolve(this._name)
        .then(function(result){
          dbg && console.log('got resolve result:',result)
          var endpoint = result[0]
          if(Array.isArray(endpoint)){
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
          }
        })
        .then(function(result){
          Service._bake(self,result)
          dbg && console.log('resolved',self._name)
        })
    }
  }
}

function Service(name){
  try {
    return require('./services/'+name)
  } catch(e) {
    if(e.code === 'MODULE_NOT_FOUND'){
      return Service.def(name,{})
    } else {
      throw e
    }
  }
}

Service.def = function(name, def){
  var S = def.__init || function Service(){
    Client.apply(this,arguments)
    this.connect()
  }
  S.prototype = {
    __proto__:Client.prototype,
    __cls:S
  }
  S._sid = 0
  S.__proto__ = _Service
  S.__def = def
  S._name = name
  return S
}

Service._bake = function (cls, result){
  dbg && console.log('_bake')
  dbg && console.log(cls.toString())
  dbg && console.log(inspect(result,false,5))
  var _ = result, name, endpoint=_[0], protocol=_[1], methods=_[2]
  var endpoint = result[0]
  var protocol = result[1]
  var methods = result[2]
  var def = cls.__def.methods || {}
  for(var k in methods){
    var mid = parseInt(k)
    var name = methods[k]
    var M = (def[name] || method.streaming) (mid)
    cls.prototype[name] = M
  }
  cls.prototype._endpoint = endpoint
  return cls
}

function getServices(names,cb){
  var pp = []
  var ss = names.map(function(name){
    var S = Service(name)
    pp.push(S.resolve())
    return S
  })
  Q.all(pp).done(function(){
    cb.apply(null,ss)
  })
}

var slice = Array.prototype.slice

var method = {
  // known service method types:
  // 1. oneoff: one-off fired, no result returned
  // 2. onechunk: with promised result contained in first chunk
  //    e.g. logger.verbosity, storage.write
  // 2a. confirmed: no actual result, but comfirmation returned
  // 3. unpacking: same as above, but value unpacked with msgpack
  // 4. streaming: returns invocation session stream
  //    e.g. storage.read
  
  oneoff:function(mid){
    return function(){
      var args = slice.call(arguments)
      this._send(mp.pack([mid, 0, args]))
    }
  },
  
  onechunk:function(mid){
    return function(){
      var args = slice.call(arguments)
      var s = this.Session()
      this._sessions[s._id] = s
      this._send(mp.pack([mid, s._id, args]))
      var chunk, f = Q.defer()
      s.on('data',function(data){
        __assert(chunk === undefined)
        chunk = data})
      s.on('end',function(){
        __assert(chunk !== undefined)
        f.resolve(chunk)})
      s.on('error',function(error){
        f.reject(error)})
      return f.promise
    }
  },

  confirmed:function(mid){
    return function(){
      var args = slice.call(arguments)
      var s = this.Session()
      this._sessions[s._id] = s
      this._send(mp.pack([mid, s._id, args]))
      var  f = Q.defer()
      s.on('data',function(data){
        __assert(0,'no data expected')})
      s.on('end',function(){
        f.resolve()})
      s.on('error',function(error){
        f.reject(error)})
      return f.promise
    }
  },
  
  unpacking:function(mid){
    return function(){
      var args = slice.call(arguments)
      var s = this.Session()
      this._sessions[s._id] = s
      this._send(mp.pack([mid, s._id, args]))
      var chunk, f = Q.defer()
      s.on('data',function(data){
        __assert(chunk === undefined)
        chunk = data})
      s.on('end',function(){
        __assert(chunk !== undefined)
        f.resolve(mp.unpack(chunk))})
      s.on('error',function(error){
        f.reject(error)})
      return f.promise
    }
  },

  streaming:function (mid){
    return  function(){
      var args = slice.call(arguments)
      var s = this.Session()
      this._sessions[s._id] = s
      this._send(mp.pack([mid, s._id, args]))
      return s
    }
  }
  
}

module.exports = {
  Service:Service,
  getServices:getServices,
  method:method
}

var Locator = require('./services/locator')
var L = new Locator()
