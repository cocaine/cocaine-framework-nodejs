
var Channel = require("../build/Release/nodejs_cocaine_framework")

var util = require("./util")


function Client(){
  EventEmitter.apply(this,arguments)
  this._hdl = {}
  util.bindHandlers(this.hdl,this._hdl,this)
}

Client.prototype = {
  __proto__:EventEmitter.prototype,
  Session:function(){
    var s = new Session()
    s._id = this._sid++
    s.owner = this
    return s
  },
  _send:function(msg){
    this._handle.send(msg)
  },
  connect:function(){
    __assert(!this._handle)
    this._handle = new Channel(this._endpoint)
    this._handle.owner = null
    util.setHandlers(this._handle,this._hdl)
  },
  close:function(){
    __assert(this._handle)
    this._handle.close()
    this._handle.owner = null
    util.unsetHandlers(this._handle,this._hdl)
    this._handle = null
  },
  hdl:{
    on_chunk:function(sid,data){
      var s = this._sessions[sid]
      if(s){
        s.push(data)
      }
    },
    on_choke:function(sid){
      var s = this._sessions[sid]
      if(s){
        s.choke()
        s.owner = null
        delete this._sessions[sid]
      }
    },
    on_error:function(sid,code,message){
      var s = this._sessions[sid]
      if(s){
        s.error(code,message)
        s.owner = null
        delete this._sessions[sid]
      }
    }
  }
}

module.exports = {
  Client:Client

}



