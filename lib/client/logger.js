
var __assert = require('assert')
var EventEmitter = require('events').EventEmitter
var format = require('util').format

var debug = require('../util').debug('co:logger')
var Service = require('./service').Service

// logging priorities
var LP = { debug: 0, info: 1, warning: 2, error: 3 }

var slice = Array.prototype.slice

function logMethod(priority){
  return function(){
    // attrs, format, args
    debug('call method with priority', priority, this._verbosity)
    if(this._verbosity <= priority){
      // method priority greater than logger verbosity
      if(typeof arguments[0] === 'object'){
        var args = slice.call(arguments)
        var attrs = args.shift()
        var message = format.apply(null, args)
        this._logging.emit(priority, this._target, message, attrs)
      } else {
        var message = format.apply(null, arguments)
        this._logging.emit(priority, this._target, message)
      }
    }
  }
}

function Logger(app){
  EventEmitter.apply(this, arguments)
  this._logging = null
  this._client = null
  this._verbosity = LP.warning
  this._state = 'closed'
  this.setAppName(app)
}

Logger.prototype = {
  __proto__: EventEmitter.prototype,
  connect: function(){
    var _this = this
    
    if(this._state === 'closed'){
      this._state = 'connecting'
      this._logging = Service('logging')
      if(this._client){
        this._logging._client = this._client
      }
      this._logging.connect()
      debug('connecting to service logging')
      this._logging.once('connect', _getVerbosity)
      this._logging.once('error', _handleConnectError)
    }
    
    function _handleConnectError(err){
      __assert(_this._state === 'connecting')
      debug('_handleConnectError')
      _this._logging.removeListener('connect', _getVerbosity)
      if(_this._logging._state !== 'closed'){
        _this._logging.close()
      }
      _this._state = 'closed'
      _this.emit('error', err)
    }

    function _getVerbosity(){
      __assert(_this._state === 'connecting', format("_this._state === 'connecting'; state %s",_this._state))
      debug('connected to service logging')
      _this._logging.removeListener('error', _handleConnectError)
      _this._logging.on('error', _handleSocketError)
      _this._logging.verbosity().recv({
        value: function(verbosity){
          debug('got verbosity', verbosity)
          if(_this._state === 'connecting'){
            _this._verbosity = verbosity
            _this._state = 'connected'
            _this.emit('connect')
          }
        },
        error: function(code, reason){
          if(_this._state === 'connecting'){
            var err = new Error(reason)
            err.code = code
            _this._logging.removeListener('error', _handleSocketError)
            _this.emit('error', err)
          }
        }
      })
    }

    function _handleSocketError(err){
      debug('handleSocketError')
      __assert(_this._state === 'connecting' || _this._state === 'connected',
               "_this._state === 'connecting' || _this._state === 'connected'")
      _this.close()
      _this.emit('error', err)
    }
  },
  setAppName:function(app){
    this._target = 'app/' + (app||'unknown')
  },
  close: function(){
    if(this._state !== 'closed'){
      this._state = 'closed'
      if(this._logging._state !== 'closed'){
        this._logging.close()
      }
      this._logging = null
    }
  },

  error: logMethod(LP.error),
  warning: logMethod(LP.warning),
  info: logMethod(LP.info),
  debug: logMethod(LP.debug)
  
}

module.exports.Logger = Logger



