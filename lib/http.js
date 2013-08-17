
var mp = require('msgpack')

var http = module.exports = require('http')

var debug;
if (process.env.NODE_DEBUG && /http/.test(process.env.NODE_DEBUG)) {
  debug = function(x) { console.error('HTTP: %s', x); };
} else {
  debug = function() { };
}

var httpServer = http.Server

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


  ServerResponse.prototype.write = function (chunk,encoding){
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

  ServerResponse.prototype.end = function(data, encoding) {
    var res = true
    if(this.finished){
      return false;
    }
    if(!this._header){
      this._implicitHeader();
    }

    if(data && !this._hasBody){
      debug('This type of response MUST NOT have a body. '+
            'Ignoring data passed to end().');
      data = false;
    }

    if(data){
      res = this.write(data, encoding);
    } else {
      this._send('');
    }

    this.finished = true;
    this._last = true;

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
    var hh = Object.keys(headers).map(function(k){
      return [k,headers[k]];
    });
    this._header = mp.pack([code,hh]);
    this._headerSent = false;
  }

  ServerResponse.prototype._send = function(data, encoding){
    if(!this._headerSent){
      this._writeRaw(this._header);
      this._headerSent = true;
    }
    this._writeRaw(data,encoding);
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

