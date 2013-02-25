

function ServerResponse(){
  this.socket = null
  this.connection = null
}

ServerResponse.prototype={
  __proto__:OutgoingMessage.prototype
  
  assignSocket:function(socket){
    __assert(!socket._httpMessage,
             "outgoing message still present")
    socket._httpMessage = this
    socket.on("close", onServerResponseClose)
    this.socket = socket
    this.connection = socket
    this._flush()
  },
  
  detachSocket:function(socket){
    __assert(socket._httpMessage === this)
    socket.removeListener("close", onServerResponseClose)
    socket._httpMessage = null
    this.socket = this.connection = null
  },
  
  writeContinue:function(){},
  
  writeHead:function(statusCode){},
  writeHeader:function(){
    this.writeHead.apply(this,arguments)},

  _implicitHeader:function(){},
}


function onServerResponseClose(){}

