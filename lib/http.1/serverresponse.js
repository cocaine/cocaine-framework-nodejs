

function ServerResponse(){
  
}

ServerResponse.prototype={
  assignSocket:function(socket){},
  detachSocket:function(socket){},
  writeContinue:function(){},
  _implicitHeader:function(){},
  
  writeHead:function(statusCode){},
  writeHeader:function(){
    this.writeHead.apply(this,arguments)},

  __proto__:OutgoingMessage.prototype
}


