
var net = require('net')
var __assert = require('assert')
var EventEmitter = require('events').EventEmitter

var util = require('../../lib/util')
var Channel = require('./channel').Channel

var trace = 1

function _parseEndpoint(){
  if(arguments.length === 1){
    var path = arguments[0]
    __assert(typeof path === 'string',
             "typeof path === 'string'")
    this._socketPath = path
  } else if (arguments.length === 2){
    var host = arguments[0]
    var port = arguments[1]
    __assert(typeof host === 'string' && typeof port === 'number',
             "typeof host === 'string' && typeof port === 'number'")
    this._host = host
    this._port = port
  } else {
    throw new Error('bad match: '+JSON.stringify(arguments))
  }
},


function Service(endpoint, dispatch){
  this._server = new net.Server({allowHalfOpen: true})
  this._path = null
  this._host = null
  this._port = null
  this._chid = 0
  this._channels = {}
  this._dispatch = dispatch || {}
  this._server.on('connection', this._hdl.connection)
  this._server.on('listening', this._hdl.listening)
  this._hdl = {}
  util.bindHandlers(this.hdl, this._hdl, this)
  _parseEndpoint.apply(this, arguments)
}

Service.prototype = {
  __proto__: EventEmitter.prototype,

  methods: {},

  onMessage: function(m){
    var ch = this
    var self = ch.owner
    if(m[0] in self._dispatch){
      var methodName = this._dispatch[m[0]]
      self.methods[methodName].call(self, ch, m)
    } else {
      trace && console.log('no method for message', m)
    }
  },

  onEnd: function(){
    trace && console.log('channel end', this._id)
  },

  onError: function(err){
    trace && console.log('channel error', this._id, err)
  },

  onClose: function(){
    trace && console.log('channel close', this._id)
  },

  hdl:{
    listening: function(){
      trace && console.log('listening')
    },
    connection: function(socket){
      var ch = new Channel(socket, this.__chid++)
      this.channels[ch._id] = ch
      ch.on('message', this.onMessage.bind(ch))
      ch.on('end', this.onEnd.bind(ch))
      ch.on('error', this.onError.bind(ch))
      ch.on('close', this.onClose.bind(ch))
      ch.owner = this
    }
  }
}

module.exports.Service = Service

