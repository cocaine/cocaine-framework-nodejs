
var CALL_TIMEOUT = 30000

var __assert = require('assert')
var util = require('util')

var __uid = require('../../util').__uid

//var streamingMethod = require('./streaming_method')

var slice = Array.prototype.slice

var trace = 0

var debug = require('debug')('co:compat:methods:callback')


function oneoff(methodName, decoder){
  return function(){
    var id = __uid()
    var args = slice.call(arguments)

    if(0 < args.length && typeof args[args.length-1] === 'function'){
      var cb = args.pop()        
    }

    var debugMessage = util.format('<Service %s>::methodImpl[%s][%s](%s)', this._name, methodName, id, args)
    debug(debugMessage)

    var s = this._service._call(methodName, args)
    s.recv({
      value: function(){
        var result = slice.call(arguments)
        debug('<Service %s>::methodImpl[%s][%s](%s): done -> `%s` ', this._name, methodName, id, args, result)
        result.unshift(null) // error
        cb && cb.apply(null, result)
      },
      error: function(ec, message){
        var descr = util.format('<Service %s>::methodImpl[%s][%s](%s): `%s`', this._name, methodName, id, args, message)
        
        var e = new Error(descr)
        e.category = ec[0]
        e.code = ec[1]
        e.stack = e.stack + util.format('\n invoked from\n %s', invokationStack)
        
        debug('<Service %s>::methodImpl[%s][%s](%s): error -> `%s` ', this._name, methodName, id, args, message)

        cb && cb(e)
      }
    })
  }
}



module.exports = {
  oneoffWithDecoder: function withDecoder(decoder){
    return function oneoffDecoded(methodName){
      return oneoff(methodName, decoder)
    }
  },
  streaming: function() {
    throw Error('Not Implemented')
  }
}


