
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var __uid = require('../../util').__uid

//var streamingMethod = require('./streaming_method')

var slice = Array.prototype.slice

var trace = 0

var debug = require('debug')('co:compat:methods:promises')

module.exports = function(Promise) {

  function oneoff(methodName, decoder){
    return function(){
      var id = __uid()
      var args = slice.call(arguments)

      var debugMessage = util.format('<Service %s>::methodImpl[%s][%s](%s)', this._name, methodName, id, args)
      debug(debugMessage)
      
      var s = this._service._call(methodName, args)

      var d = Promise.defer()
      var invokationStack = new Error(debugMessage).stack
      
      s.recv({
        value: function(){
          var result = slice.call(arguments)

          debug('<Service %s>::methodImpl[%s][%s](%s): done -> `%s` ', this._name, methodName, id, args, result)
          if(decoder){
            result = decoder(result)
            debug('using decoded result', result)
          }
          
          Promise.fulfill(d, result)
        },
        error: function(ec, message){
          var descr = util.format('Error at <Service %s>::methodImpl[%s][%s](%s): `%s`', this._name, methodName, id, args, message)
          
          var e = new Error(descr)
          e.category = ec[0]
          e.code = ec[1]
          e.stack = e.stack + util.format('\n invoked from\n %s', invokationStack)
          
          debug('<Service %s>::methodImpl[%s][%s]: error -> `%s` ', this._name, methodName, id, message)
          
          Promise.reject(d, e)
        }
      })

      return Promise.promise(d)
    }
  }

  
  return {

    oneoffWithDecoder: function withDecoder(decoder){
      return function oneoffDecoded(methodName){
        return oneoff(methodName, decoder)
      }
    },
    
    oneoff: oneoff,
    streaming: function() {
      throw Error('Not Implemented')
    }
  }
}


