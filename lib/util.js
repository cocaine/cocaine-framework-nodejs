

module.exports = {
  bindHandlers:function(handlers,_handlers,self){
    for(var fn in handlers){
      if(typeof handlers[fn] === "function"){
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

