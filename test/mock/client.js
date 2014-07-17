

var net = require('net')
var mp = require('msgpack')

var EventEmitter = require('events').EventEmitter


var util = require('../../lib/util')
var Channel = require('./channel').Channel

var trace = 1

var __cid = 0


function Client(dispatch){
  this._id = __cid++
  var ch = this._channel = new Channel()
  
  this._dispatch = dispatch || {}
  this._hdl = {}
  util.bindHandlers(this.hdl, this._hdl, this)

  ch.on('connect', this._hdl.connect)
  ch.on('message', this._hdl.message)
  ch.on('end', this._hdl.end)
}


Client.prototype = {
  __proto__: EventEmitter.prototype,

  connect: function(){
    this._channel.connect.apply(this._channel, arguments)
  },

  send: function(m){
    this._channel.send(m)
  },

  methods: {},

  hdl: {
    connect: function(){
      trace && console.log('channel connect')
      this.emit('connect')
    },

    end: function(){
      trace && console.log('channel end')
      this.emit('end')
    },

    message: function(m){
      trace && console.log('channel message')
      if(m[0] in this._dispatch){
        var methodName = this._dispatch[m[0]]
        this.methods[methodName].call(this, m)
      } else {
        trace && console.log('no method for message', m)
      }
    }
  }
  
}


module.exports.Client = Client


