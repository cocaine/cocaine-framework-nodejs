
var mp = require('msgpack-bin')

var http = module.exports = require('http')

var __assert = require("assert")

var debug = require('debug')('co:http')

var httpServer = http.Server

var X_COCAINE_HTTP_PROTO_VERSION = "X-Cocaine-HTTP-Proto-Version";

function Server(){
  httpServer.apply(this,arguments)
  this.httpAllowHalfOpen = true
}

module.exports.Server = Server
module.exports.createServer = function(requestListener){
  return new Server(requestListener)
}

Server.prototype = httpServer.prototype

var ServerResponse = http.ServerResponse

if(!http.ServerResponse.__cocaine_patched){
  http.ServerResponse.__cocaine_patched = true;

  // var write = ServerResponse.prototype.write
  // var end = ServerResponse.prototype.end
  var SR_writeHead = ServerResponse.prototype.writeHead
  // var _send = ServerResponse.prototype._send 
  // var _writeRaw = ServerResponse.prototype._writeRaw
  // var _buffer = ServerResponse.prototype._buffer

  // var storeHeader = ServerResponse.prototype.storeHeader
  var SR__storeHeader = ServerResponse.prototype._storeHeader

  ServerResponse.prototype.write = function(chunk, encoding, callback) {
    if (!this._header) {
      this._implicitHeader();
    }

    if (!this._hasBody) {
      debug('This type of response MUST NOT have a body. ' +
            'Ignoring write() calls.');
      return true;
    }

    if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
      throw new TypeError('first argument must be a string or Buffer');
    }

    // If we get an empty string or buffer, then just do nothing, and
    // signal the user to keep writing.
    if (chunk.length === 0) return true;

    var len, ret;
    if (true) {
      ret = this._send(chunk, encoding, callback);
    }

    debug('write ret = ' + ret);
    return ret;
  }


  ServerResponse.prototype.__write = function (chunk,encoding){
    if(!this._header){
      this._implicitHeader();
    }

    if(!this._hasBody){
      debug('This type of response MUST NOT have a body. ' +
            'Ignoring write() calls.');
      return true;
    }

    if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)){
      throw new TypeError('first argument must be a string or Buffer');
    }

    if(chunk.length === 0){
      return true;
    }

    var len, ret;
    this._send(chunk, encoding);

    debug('write ret = ' + ret);
    return ret;
    
  }

  
  
  ServerResponse.prototype.end = function(data, encoding, callback) {
    if (typeof data === 'function') {
      callback = data;
      data = null;
    } else if (typeof encoding === 'function') {
      callback = encoding;
      encoding = null;
    }

    if (data && !typeof data === 'string' && !Buffer.isBuffer(data)) {
      throw new TypeError('first argument must be a string or Buffer');
    }

    if (this.finished) {
      return false;
    }

    var self = this;
    function finish() {
      self.emit('finish');
    }

    if (typeof callback === 'function')
      this.once('finish', callback);


    if (!this._header) {
      this._implicitHeader();
    }

    if (data && !this._hasBody) {
      debug('This type of response MUST NOT have a body. ' +
            'Ignoring data passed to end().');
      data = null;
    }

    if (this.connection && data)
      this.connection.cork();

    var ret;
    if (data) {
      // Normal body write.
      ret = this.write(data, encoding);
    }

    if(true){
      debug('Force a flush, HACK.')
      ret = this._send('', 'binary', finish);
    }

    if (this.connection && data)
      this.connection.uncork();

    this.finished = true;

    // There is the first message on the outgoing queue, and we've sent
    // everything to the socket.
    debug('outgoing message end.');
    if (this.output.length === 0 && this.connection._httpMessage === this) {
      this._finish();
    }

    return ret;
  }


  ServerResponse.prototype.__end = function(data, encoding) {
    debug('SR.end')
    var res = true
    if(this.finished){
      debug('-- SR.finished', this.finished)
      return false;
    }
    if(!this._header){
      debug('-- SR.implicit header')
      this._implicitHeader();
    }

    if(data && !this._hasBody){
      debug('This type of response MUST NOT have a body. '+
            'Ignoring data passed to end().');
      data = false;
    }

    if(data){
      debug('-- data present, so writing data')
      res = this.write(data, encoding);
    } else {
      debug('-- no data present, triggering send')
      this._send('', function(){
        
      });
    }

    this.finished = true;
    this._last = true;

    debug('this.output.length === 0 && this.connection._httpMessage === this', this.output, this.connection._httpMessage === this)
    if(this.output.length === 0 && this.connection._httpMessage === this){
      this._finish()
    }

    return res
    
  }

  ServerResponse.prototype.writeHead = function(statusCode) {
    this.__statusCode = statusCode;
    return SR_writeHead.apply(this,arguments);
  }

  ServerResponse.prototype._storeHeader = function(firstLine, headers) {
    SR__storeHeader.apply(this,arguments)
    var code = this.__statusCode || this.statusCode;
    headers = headers || { date : new Date().toUTCString()}
    var hh = Object.keys(headers).map(function(k){
      return [k,headers[k].toString()];
    });
    this._header = mp.pack([code,hh]);
    this._headerSent = false;
  }

  ServerResponse.prototype._send = function(data, encoding, oncomplete){
    if(!this._headerSent){
      this._writeRaw(this._header);
      this._headerSent = true;
    }
    this._writeRaw(data, encoding, oncomplete);
  }

  ServerResponse.prototype.cocaineLingeringShutdown = function(){

    var h = this.socket._handle;
    __assert(h && h.cocaineLingeringShutdownClose, "should be called on active request with attached cocaine handle");

    this.setHeader(X_COCAINE_HTTP_PROTO_VERSION, "1.1");

    h.setCocaineLingeringShutdown(true);
    return {
      close: function(){
        h.cocaineLingeringShutdownClose();
      }
    };
  }

  //ServerResponse.prototype._writeRaw
  //ServerResponse.prototype._implicitHeader


  ServerResponse.prototype.addTrailers = function(headers){
    throw new Error('.addTrailers not supported');
  }

  ServerResponse.prototype.writeContinue = function(){
    //be a nop:
    //throw new Error('.writeContinue not supported');
  }

  //OutgoingMessage.prototype._buffer = function(data, encoding)
  //OutgoingMessage.prototype.setHeader = function(name, value)
  //OutgoingMessage.prototype.getHeader = function(name)
  //OutgoingMessage.prototype.removeHeader = function(name)
  //OutgoingMessage.prototype._renderHeaders = function()

  //OutgoingMessage.prototype._finish = function()
  //OutgoingMessage.prototype._flush = function()

  //ServerResponse.prototype.statusCode = 200;
  //ServerResponse.prototype.assignSocket = function(socket)
  //ServerResponse.prototype.detachSocket = function(socket) 
}

