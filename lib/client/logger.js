
var debug = require('../util').debug('co:logger')

var __assert = require('assert')
var EventEmitter = require('events').EventEmitter
var format = require('util').format

var Service = require('./service').Service

var VL = {ignore:0, error:1, warn: 2, info: 3, debug: 4}

var slice = Array.prototype.slice

function logMethod(level){
  return function(){
    if(level <= this._verbosity){
      if(typeof arguments[arguments.length-1] === 'function'){
        var args = slice.call(arguments)
        var cb = args.pop()
        var message = format.apply(null, args)
        this._logging.emit(level, this._target, message, cb)
      } else {
        var args = arguments
        var message = format.apply(null, args)
        this._logging.emit(level, this._target, message)
      }
    }
  }
}

function Logger(app){
  EventEmitter.apply(this, arguments)
  this._logging = null
  this._client = null
  this.setAppName(app)
  this._verbosity = VL.warn
  this._state = 'closed'
}

Logger.prototype = {
  __proto__: EventEmitter.prototype,
  connect: function(){
    var _this = this
    if(this._state === 'closed'){
      this._state = 'connecting'
      this._logging = new (Service('logging'))()
      if(this._client){
        this._logging._client = this._client
      }
      this._logging.connect()
      debug('Logger: connecting to service logging')
      this._logging.once('connect', _getVerbosity)
      this._logging.once('error', _handleConnectError)
    }
    
    function _handleConnectError(err){
      __assert(_this._state === 'connecting')
      console.log('_handleConnectError')
      _this._logging.removeListener('connect', _getVerbosity)
      if(_this._logging._state !== 'closed'){
        _this._logging.close()
      }
      _this._state = 'closed'
      _this.emit('error', err)
    }

    function _getVerbosity(){
      __assert(_this._state === 'connecting', format("_this._state === 'connecting'; state %s",_this._state))
      debug('Logger: connected to service logging')
      _this._logging.removeListener('error', _handleConnectError)
      _this._logging.on('error', _handleSocketError)
      _this._logging.verbosity(_verbosityDone)
    }

    function _verbosityDone(err, verbosity){
      __assert(_this._state !== 'connected', format('state %s',_this._state))
      if(_this._state === 'connecting'){
        if(err) {
          _this._logging.removeListener('error', _handleSocketError)
          _this.close()
          return _this.emit('error', err)
        }
        _this._verbosity = verbosity
        _this._state = 'connected'
        _this.emit('connect')
      }
    }

    function _handleSocketError(err){
      debug('handleSocketError')
      __assert(_this._state === 'connecting' || _this._state === 'connected')
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

  error: logMethod(VL.error),
  warn: logMethod(VL.warn),
  info: logMethod(VL.info),
  debug: logMethod(VL.debug)
  
}

module.exports.Logger = Logger



