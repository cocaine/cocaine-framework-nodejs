

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
  
  _buffer:function(data,encoding){
    //push data and encoding to this.output and this.outputEncoding
    //merging data with last data pushed if passed encodings
    //allow that
    if(data.length === 0){
      return}
    var length = this.output.length
    if(length === 0 || typeof data !== "string"){
      this.output.push(data)
      this.outputEncodings.push(encoding)
      return false
    }
    var lastEncoding = this.outputEncodings[length-1]
    var lastData = this.output[length-1]
    if((encoding && lastEncoding === encoding) ||
       (!encoding && data.constructor === lastData.constructor)){
      this.output[length-1] = lastData + data
      return false
    }
    this.output.push(data)
    this.outputEncodings.push(encoding)
    return false //we always return false as we don't actually write here
  },
  
  _flush:function(){ // is it really necessary with cocaine?
    // original comment from node.http:
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
    
    if(!this.socket){
      //why can it be?
      return}
    while(this.output.length){
      // while still can write to socket
      if(!this.socket.writable){
        return}
      // blow out all outgoing chunks
      var data = this.output.shift()
      var encoding = this.outputEncodings.shift()

      var ret = this.socket.write(data,encoding)
    }
    if(this.finished){
      // if .end() was called, i.e. this.finished === true:
      this._finish() //emits "finish" mostly 
      // so we bring the next message
    } else if(ret){
      // if can write more, we are drain:
      this.emit("drain")
    }
  },
  
  _finish:function(){
    __assert(this.connection
             && this instanceof ServerResponse) 
    this.emit("finish")
  },

  _renderHeaders:function(){},
  _storeHeader:function(){},

  
}

