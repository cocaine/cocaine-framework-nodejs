

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
  
  writeContinue:nop, // never really used

ServerResponse.prototype.writeHead = function(statusCode) {
  var reasonPhrase, headers, headerIndex;

  if (typeof arguments[1] == 'string') {
    reasonPhrase = arguments[1];
    headerIndex = 2;
  } else {
    reasonPhrase = STATUS_CODES[statusCode] || 'unknown';
    headerIndex = 1;
  }
  this.statusCode = statusCode;

  var obj = arguments[headerIndex];

  if (obj && this._headers) {
    // Slow-case: when progressive API and header fields are passed.
    headers = this._renderHeaders();

    if (Array.isArray(obj)) {
      // handle array case
      // TODO: remove when array is no longer accepted
      var field;
      for (var i = 0, len = obj.length; i < len; ++i) {
        field = obj[i][0];
        if (field in headers) {
          obj.push([field, headers[field]]);
        }
      }
      headers = obj;

    } else {
      // handle object case
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k) headers[k] = obj[k];
      }
    }
  } else if (this._headers) {
    // only progressive api is used
    headers = this._renderHeaders();
  } else {
    // only writeHead() called
    headers = obj;
  }

  var statusLine = 'HTTP/1.1 ' + statusCode.toString() + ' ' +
                   reasonPhrase + CRLF;

  if (statusCode === 204 || statusCode === 304 ||
      (100 <= statusCode && statusCode <= 199)) {
    // RFC 2616, 10.2.5:
    // The 204 response MUST NOT include a message-body, and thus is always
    // terminated by the first empty line after the header fields.
    // RFC 2616, 10.3.5:
    // The 304 response MUST NOT contain a message-body, and thus is always
    // terminated by the first empty line after the header fields.
    // RFC 2616, 10.1 Informational 1xx:
    // This class of status code indicates a provisional response,
    // consisting only of the Status-Line and optional headers, and is
    // terminated by an empty line.
    this._hasBody = false;
  }

  // don't keep alive connections where the client expects 100 Continue
  // but we sent a final status; they may put extra bytes on the wire.
  if (this._expect_continue && ! this._sent100) {
    this.shouldKeepAlive = false;
  }

  this._storeHeader(statusLine, headers);
};
  
  writeHead:function(statusCode /*[,reasonPhrase] [,headers]*/){
    //generate (render) headers tuple
    //detect if we have body
    //call ._storeHeader
  },
  writeHeader:function(){
    this.writeHead.apply(this,arguments)},

  _implicitHeader:function(){},
}


function onServerResponseClose(){}

