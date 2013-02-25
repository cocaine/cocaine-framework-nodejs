

function OutgoingMessage(){
  
}

OutgoingMessage.prototype={
  __proto__:Stream.prototype,
  
  write:function(chunk,encoding){},
  end:function(chunk,encoding){},
  destroy:function(){},

  setHeader:function(k,v){},
  getHeader:function(k){},
  removeHeader:function(k){},
  
  _send:function(data,encoding){},
  _writeRaw:function(data,encoding){},
  _buffer:function(data,encoding){},
  
OutgoingMessage.prototype._flush = function() {
  // This logic is probably a bit confusing. Let me explain a bit:
  //
  // In both HTTP servers and clients it is possible to queue up several
  // outgoing messages. This is easiest to imagine in the case of a client.
  // Take the following situation:
  //
  //    req1 = client.request('GET', '/');
  //    req2 = client.request('POST', '/');
  //
  // When the user does
  //
  //   req2.write('hello world\n');
  //
  // it's possible that the first request has not been completely flushed to
  // the socket yet. Thus the outgoing messages need to be prepared to queue
  // up data internally before sending it on further to the socket's queue.
  //
  // This function, outgoingFlush(), is called by both the Server and Client
  // to attempt to flush any pending messages out to the socket.

  if (!this.socket) return;

  var ret;
  while (this.output.length) {

    if (!this.socket.writable) return; // XXX Necessary?

    var data = this.output.shift();
    var encoding = this.outputEncodings.shift();

    ret = this.socket.write(data, encoding);
  }

  if (this.finished) {
    // This is a queue to the server or client to bring in the next this.
    this._finish();
  } else if (ret) {
    // This is necessary to prevent https from breaking
    this.emit('drain');
  }
}

  _flush:function(){ // is it really necessary?
    if(!this.socket){
      //why can it be?
      return}
    // while socket still writeble,
    // blow out all outgoing chunks
    // if .end() was called, i.e. this.finished === true:
    //   this._finish() // bring the next message
    // if it was not and can write more, we are drain:
    //   this.emit("drain")
    
  },

  _finish:function(){},

  _renderHeaders:function(){},
  _storeHeader:function(){},

  
}

