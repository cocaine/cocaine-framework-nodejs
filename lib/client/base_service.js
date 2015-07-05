
var EventEmitter = require('events').EventEmitter
var __assert = require('assert')
var util = require('util')
var inspect = util.inspect
var makeError = require('../util').makeError

var Session = require('./session').Session
var Channel = require('./channel').Channel

var __stop = require('./graph').__stop

var mp = require('msgpack-bin')

var debug = require('debug')('co:base_service')

function BaseService(){
  this.__sid = 1
  this._sessions = {}
  this.__graph = null

  this._channel = null
  this._connecting = false
  // the invariant is:
  // (!this._channel && !this._connecting)
  //   || (this._channel && this._connecting)
  //   || (this._channel && !this._connecting)
  this._effectiveEndpoint = undefined
  var self = this
  this._hdl = {
    message: function(){
      self.hdl.message.apply(self, arguments)
    }
  }

}


BaseService.prototype = {

  __proto__: EventEmitter.prototype,
  
  connect: function(endpoints){
    // consecutively connect to endpoints
    debug('connect to endpoints ', endpoints)

    __assert(!this._channel, 'should not connect with existing channel')

    var self = this

    var i = 0
    _nextEndpoint()
    
    function _nextEndpoint(){
      if(i < endpoints.length){
        var endpoint  = endpoints[i++]

        self._effectiveEndpoint = endpoint
        debug('connecting to ', self._effectiveEndpoint)

        self._channel = new Channel(endpoint[0], endpoint[1])
        self._channel.owner = this
        self._channel.on_connect = _on_connect
        self._channel.on_socket_error = _on_connect_error

        //self._channel.connect(endpoint)
      } else {
        var err = new Error('can not connect to any of the endpoints: '+util.inspect(endpoints))
        err.code = 'ECONNREFUSED'
        self.emit('error', err)
      }
    }

    function _on_connect(){
      self._channel.on_connect = null
      self._channel.on_socket_error = _on_socket_error
      self._channel.on_message = self._hdl.message
      self.emit('connect')
    }

    function _on_connect_error(){
      var ch = self._channel
      self._channel = null
      ch.owner = null
      ch.on_connect = null
      ch.on_socket_error = null

      _nextEndpoint()
    }

    function _on_socket_error(errno){
      var ch = self._channel
      self._channel = null
      ch.owner = null
      ch.on_connect = null
      ch.on_socket_error = null
      var err = makeError(errno)
      self.resetSessions(err)
      self.emit('error', err)
    }
    
  },

  hdl: {
    message: function(m){
      var sid = m[0], mid = m[1], args = m[2]
      var s = this._sessions[sid]
      if(s){
        s.push(m)
      }
    }
  },

  close: function(err){
    if(this._channel){
      if(this._connecting){
        // cancel connect
        var ch = this._channel
        this._channel = null
        ch.owner = null
        ch.close()
      } else {
        // or close connection and reset sessions
        var ch = this._channel
        this._channel = null
        ch.owner = null
        ch.close()
        if(!err){
          var err = new Error('connection closed by application')
          err.code = 'ECONNRESET'
        }
        this.resetSessions(err)
      }
    }
  },

  _setGraph: function(_graph){
    var graph_ = {}
    for(var k in _graph){
      var idx = parseInt(k)
      var methodGraph = _graph[k]
      var methodName = methodGraph[0]
      var txGraph = methodGraph[1]
      var rxGraph = methodGraph[2]
      graph_[methodName] = [idx, txGraph, rxGraph]
    }
    this.__graph = graph_
  },

  _send: function(m){
    debug('._send( %s )', inspect(m))
    this._channel.send(mp.pack(m))
  },

  _call: function(methodName, args){

    __assert(methodName in this.__graph && typeof args === 'object' && typeof args.length === 'number')

    debug('<BaseService>._call method', methodName)

    var methodDef = this.__graph[methodName]
    var mid = methodDef[0]
    var txGraph = methodDef[1]
    var rxGraph = methodDef[2]

    debug('txGraph', txGraph)
    debug('rxGraph', txGraph)
    
    var s = new Session(this.__sid++, txGraph, rxGraph)
    s._owner = this

    this._send([s._id, mid, args])

    if(Object.keys(rxGraph).length !== 0){
      this._sessions[s._id] = s
    } else {
      debug('method not found', methodName)
    }

    return s
  },
  
  clearSession: function(id){
    if(id in this._sessions){
      delete this._sessions[id]      
    }
  },

  resetSessions: function(err){
    var ss = this._sessions
    this._sessions = {}

    for(var id in ss){
      ss[id].error(err)
    }
    
  }
  
}

module.exports.BaseService = BaseService