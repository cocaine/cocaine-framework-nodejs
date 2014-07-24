
var EventEmitter = require('events').EventEmitter
var util = require('util')

var linkProtoProps = require('./util').linkProtoProps

var __assert = require('assert')

module.exports.ErrorEmitter = ErrorEmitter

function ErrorEmitter(){
  EventEmitter.apply(this, arguments)
  this._errorHandler = null
  linkProtoProps(this, 'errorHandler')
}


ErrorEmitter.prototype = {
  __proto__: EventEmitter.prototype,

  beforeError: function(err){

    if (typeof this._events.beforeError === 'function'
        || (typeof this._events.beforeError === 'object' &&
            0 < this._events.beforeError.length)) {

      var handlers = this._events.beforeError

      if(this.domain && this!==process){
        this.domain.enter()
      }

      if(typeof handlers === 'function'){
        return handlers.call(this, err)
      } else {
        __assert(typeof handlers === 'object' && 0 < handlers.length,
                 "typeof handlers === 'object' && 0 < handlers.length")

        handlers0 = handlers.slice()

        for(var i=0; i < handlers0.length; i++){
          var r = handlers0[i].call(this, err)
          if(r === true){
            return true
          }
        }
      }
      
    }

  },

  _setErrorHandler: function(hdl){
    __assert(this._errorHandler === null, 'this._errorHandler === null')
    this._errorHandler = hdl
  },

  _popErrorHandler: function(){
    var hdl = this._errorHandler
    hdl && __assert(typeof hdl === 'object' && typeof hdl.length === 'number')
    this._errorHandler = null
    return hdl
  },

  _callErrorHandler: function(hdl){
    __assert(typeof hdl === 'object' && typeof hdl.length === 'number') 
    var name = hdl.shift()
    var args = hdl

    __assert(typeof name === 'string')

    var errorHandler = this.errorHandlers[name]
    
    __assert(typeof errorHandler === 'function')

    return errorHandler.apply(this, args)
    
  }
  
}

