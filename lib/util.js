
var _ERRNO = require('./errno').code
var ERRNO = require('./errno').errno
var format = require('util').format


module.exports = {
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
  }
}

