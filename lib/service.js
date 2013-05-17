
var inspect = require("util").inspect
var __assert = require("assert")

var Q = require("q")
var mp = require("msgpack")

var Client = require("./client").Client

var _Service = {
  __proto__:Function.prototype.
  resolve:function(result){
    if(result){
      Service._bake(this,result)
    } else {
      var self = this
      return Locator.resolve(this._name)
        .then(function(result){
          Service._bake(self,result)
        })
    }
  }
}

function Service(name){
  try {
    return require("./services/"+name)
  } catch(e) {
    return Service.def(name,{})
  }
}

Service.def = function(name, def){
  var S = def.__init || function Service(){
    Client.apply(this,arguments)
    this.connect()
  }
  S.prototype = {
    __proto__:Client.prototype
    __cls:S
  }
  S._sid = 0
  S.__proto__ = _Service
  S.__def = def
  S._name = name
  return S
}

Service._bake = function (cls, result){
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
      this._send(mp.pack([mid, s._id, args]))
    }
  },
  
  onechunk:function(mid){
    return function(){
      var args = slice.call(arguments)
      var s = this.Session()
      this._sessions[s._id] = s
      this._send(mp.pack([mid, s._id, args]))
      var chunk, f = Q.defer()
      s.on("data",function(data){
        __assert(chunk === undefined)
        chunk = data})
      s.on("end",function(){
        __assert(chunk !== undefined)
        f.resolve(chunk)})
      s.on("error",function(error){
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
      s.on("data",function(data){
        __assert(0,"no data expected")})
      s.on("end",function(){
        f.resolve()})
      s.on("error",function(error){
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
      s.on("data",function(data){
        __assert(chunk === undefined)
        chunk = data})
      s.on("end",function(){
        __assert(chunk !== undefined)
        f.resolve(mp.unpack(chunk))})
      s.on("error",function(error){
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
  method:method
}


