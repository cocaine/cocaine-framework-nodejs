
var __assert = require('assert')

var _ERRNO = require('./errno').code
var ERRNO = require('./errno').errno
var format = require('util').format


module.exports = {
  __uid: function(){
    return Math.floor(Math.random()*0x100000000).toString(36)
  },
  makeError: function(errno, message){
    message = message || _ERRNO[errno] || 'unknown'
    var e = new Error(message)
    e.code = _ERRNO[errno]
    return e
  },
  bindHandlers:function(handlers,_handlers,self){
    for(var fn in handlers){
      if(typeof handlers[fn] === 'function'){
        _handlers[fn] = handlers[fn].bind(self)
      }
    }
  },
  setHandlers:function(wrap,handlers){
    for(var fn in handlers){
      wrap[fn] = handlers[fn]
    }
  },
  unsetHandlers:function(wrap,handlers){
    for(var fn in handlers){
      delete wrap[fn]
    }
  },
  debug:function(subsys){
    var re = new RegExp(subsys)
    if(process.env.NODE_DEBUG && re.test(process.env.NODE_DEBUG)){
      return function(){
        var entry = format.apply(null, arguments)
        console.log('%s:', subsys, entry)
      }
    } else {
      return function(){}
    }
  },

  // link in proto chain `.prop` subobjects in
  // `self` and all it's proto-predecessors
  linkProtoProps: function(self, prop){
    __assert(typeof self === 'object' && typeof prop === 'string',
             "typeof self === 'object' && typeof prop === 'string'")
    
    var p0, p1

    p0 = self
    // find first proto with prop
    while(!p0.hasOwnProperty(prop)){
      // we need to go deeper:
      p0 = p0.__proto__
      if(p0 === null){
        return
      }
    }

    propVal0 = p0[prop]
    if(typeof propVal0 !== 'object' || propVal0 === null){
      return
    }
    
    p1 = p0.__proto__

    while(p1 !== null){

      if(p1.hasOwnProperty(prop)){
        var propVal1 = p1[prop]
        if(typeof propVal1 === 'object' && propVal1 !== null){
          // link
          propVal0.__proto__ = propVal1

          // advance state
          p0 = p1
          propVal0 = propVal1

          // go deeper
          p1 = p0.__proto__
          
        } else {
          break
        }
      } else {
        
        p1 = p1.__proto__
      }
    }
  },

  fmt: format
}

