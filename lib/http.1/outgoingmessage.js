

function OutgoingMessage(){
  
}

OutgoingMessage.prototype={
  
  write:function(chunk,encoding){},
  end:function(chunk,encoding){},
  destroy:function(){},

  setHeader:function(k,v){},
  getHeader:function(k){},
  removeHeader:function(k){},
  
  _send:function(data,encoding){},
  _writeRaw:function(data,encoding){},
  _buffer:function(data,encoding){},
  
  _flush:function(){},
  _finish:function(){},

  _renderHeaders:function(){},
  _storeHeader:function(){},

  __proto__:Stream.prototype
  
}

