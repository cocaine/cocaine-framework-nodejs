
var Stream = require("stream")
var __assert = require("assert")


function OutgoingMessage(){
  this._headerSent = false
  this._headers = null
  this._headerNames = null
  this._header = ""
  this._trailer = ""
  this.chunkedEncoding = false
  this.sendDate = false
}

OutgoingMessage.prototype={
  __proto__:Stream.prototype,
  
  destroy:function(error){
    this.socket.destroy(error)},
  
  write:function(chunk,encoding){
    //check if we wrote header, do it if not
    if(!this._header){
      this._implicitHeader()}
    if(!this._hasBody){
      //if no body, just ignore write calls
      return true}
    if(!(typeof chunk === "string"
         || Buffer.isBuffer(chunk))){
      throw new TypeError("first argument must be a string or a Buffer")
    }
    if(chunk.length === 0){
      return false
    }
    if(!this.chunkedEncoding){
      return this._send(chunk,encoding)
    } else {
      __assert(0,"chunked encoding is not supported")
    }
  },
  
  end:function(chunk,encoding){
    if(!this.finished){
      //form header if there's still no one
      if(!this._header){
        this._implicitHeader()
      }
      //ignore data if no body should be in request
      if(data && !this._hasBody){
        data = false
      }
      //"hot" case to be discussed later
      //for now, just .write(data,encoding)
      if(data){
        var ret = this.write(data,encoding)
      }
      //force a flush with ._send(""). Why not just ._flush, btw?
      var ret = this._send("")
      this.finished = true
      //if no outpuch chunks left,
      //  bring out the next message
      //  with .emit("finish")
      if(this.output.length === 0 && this.connection._httpMessage === this){
        this._finish()
      }
      return ret
    } else {
      return false
    }
  },

  setHeader:function(name,value){
    if (arguments.length < 2) {
      throw new Error('`name` and `value` are required for setHeader().')
    }

    if (this._header) {
      throw new Error('Can\'t set headers after they are sent.')
    }

    var key = name.toLowerCase()
    this._headers = this._headers || {}
    this._headerNames = this._headerNames || {}
    this._headers[key] = value
    this._headerNames[key] = name
  },

  getHeader:function(name){
    if (arguments.length < 1) {
      throw new Error('`name` is required for getHeader().')
    }

    if (!this._headers){
      return}

    var key = name.toLowerCase()
    return this._headers[key]
  },

  removeHeader:function(name){
    if (arguments.length < 1) {
      throw new Error('`name` is required for removeHeader().')
    }

    if (this._header) {
      throw new Error('Can\'t remove headers after they are sent.')
    }

    if (!this._headers){
      return}

    var key = name.toLowerCase()
    delete this._headers[key]
    delete this._headerNames[key]
  },
  
  _send:function(data,encoding){
    //so this one does either _writeRaw() either _buffer()
    //haha! if fact, it always does _writeRaw()!
    
    //===original coment ================
    //= This is a shameful hack to get the headers and first body chunk onto
    //= the same packet. Future versions of Node are going to take care of
    //= this at a lower level and in a more general way.
    if(!this._headerSent){
      if(typeof data === "string"){
        data = this._header + data //if we can, just concat them!
      } else{
        this.output.unshift(this._header)
        this.outputEncodings.unshift("ascii")
      }
      this._headerSent = true
    }
    return this._writeRaw(data,encoding)
  },

  _writeRaw:function(data,encoding){
    // if connection is writable and it's we who are attached to it,
    // purge output and write data directly to the socket
    // otherwise just ._buffer(data)
    if(data.length === 0){
      return true}
    if(this.connection &&
       this.connection._httpMessage === this &&
       this.connection.writable){
      while(this.output.length){
        //why are we here? just woke up or something?
        if(!this.connection.writable){
          return this._buffer(data,encoding)
        }
        var c = this.output.shift()
        var e = this.outputEncodings.shift()
        this.connection.write(c,e) //we don't check ret here.
        //we return up there if conn isn't writable anymore
      }
      // we win if we come here!
      // Directly write to socket.
      return this.connection.write(data, encoding);
    } else {
      return this._buffer(data,encoding)
    }
  },
  
  _buffer:function(data,encoding){
    //push data and encoding to this.output and this.outputEncoding
    //merging data with last data pushed if passed encodings
    //allow that
    if(data.length === 0){
      return // we don't return false here? why?
    }
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

  _renderHeaders:function(){
    if(this._header){
      throw new Error("Can't render headers after they are sent away")}
    if(!this._headers){
      return {}}
    var headers = {}
    Object.keys(this._headers).some(function(key){
      headers[this._headerNames[key]] = this._headers[key]})
    return headers
  },

  _storeHeader:function(firstLine,headers,code){
    var hh=[]
    function store(field, value){
      if (/[\r\n]/.test(value)){
        value = value.replace(/[\r\n]+[ \t]*/g, '')}
      
      //let messageHeader be concatenated headers string
      hh.push([field,value]) //that's what we do instead
      
      //some http logic here, too.
      //  set flags so we know we did send:
      //    keep-alive
      //    transfer-encoding
      //    content-length
      //    expect
    }
    //with every header in headers dict:
    //  handle differend form of header: array and string
    //add date header
    //something about keep-alive
    //this._header = messageHeader + CRLF
    this._header = mp.pack({code:this.statusCode, headers:hh})
    //so, we don't send anything here,
    //  unless we have to send 100-continue
    //  and we never have that.
  }

  
}

module.exports = OutgoingMessage