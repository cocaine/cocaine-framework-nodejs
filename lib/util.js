
var _ERRNO = require('./errno').code
var debug = require('debug')

var slice = Array.prototype.slice

function formatArgs() {
  var args = slice.call(arguments);
  var useColors = this.useColors;
  var name = this.namespace;

  var traceId = args[0]

  if(typeof traceId === 'string' && traceId[0] === '$' && traceId[1] === '$'){
    args.shift()
    traceId = traceId.slice(2)
  } else {
    traceId = ''
  }

  args[0] = Date.now() +
    ' (+' + debug.humanize(this.diff) + ') '+
    name + ' ' + traceId + ' ' + args[0]
    

  return args;
}

debug.formatArgs = formatArgs


module.exports = {
  debug: debug,
  makeError: function(errno, message){
    var e = new Error(message || '')
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
  }
}

