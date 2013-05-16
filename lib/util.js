

module.exports = {
  bindHandlers:function(handlers,_handlers,self){
    for(var fn in handlers){
      if(typeof handlers[fn] === "function"){
        _handlers[fn] = handlers[fn]
      }
    }
  },
  setHandlers:function(handlers,wrap){
    for(var fn in handlers){
      wrap[fn] = handlers[fn]
    }
  },
  unsetHandlers:function(handlers,wrap){
    for(var fn in handlers){
      delete wrap[fn]
    }
  }
}

