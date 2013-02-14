
function sessionOnHeadersComplete(env) {
  var session = this;
  var headers = info.headers;
  var url = info.url;

  session.incoming = new IncomingMessage(session);
  session.incoming.httpVersionMajor = info.versionMajor;
  session.incoming.httpVersionMinor = info.versionMinor;
  session.incoming.httpVersion = info.versionMajor + '.' + info.versionMinor;
  session.incoming.url = url;

  var n = headers.length;

  for (var i = 0; i < n; i++) {
    var k = headers[i][0];
    var v = headers[i][1];
    session.incoming._addHeaderLine(k, v);
  }

  session.incoming.method = info.method;

  //session.incoming.upgrade = info.upgrade;

  session.onIncoming(session.incoming);
}

function sessionOnBody(chunk) {
  var session = this;
  if (session.incoming._paused || session.incoming._pendings.length) {
    session.incoming._pendings.push(chunk);
  } else {
    session.incoming._emitData(chunk);
  }
}

function sessionOnMessageComplete() {
  var session = this;
  session.incoming.complete = true;

  // // Emit any trailing headers.
  // var headers = session._headers;
  // if (headers) {
  //   for (var i = 0, n = headers.length; i < n; i++) {
  //     var k = headers[i][0];
  //     var v = headers[i][1];
  //     session.incoming._addHeaderLine(k, v);
  //   }
  //   session._headers = [];
  //   session._url = '';
  // }

  if (session.incoming._paused || session.incoming._pendings.length) {
    session.incoming._pendings.push(END_OF_FILE);
  } else {
    session.incoming.readable = false;
    session.incoming._emitEnd();
  }

  if (session.socket.readable) {
    // force to read the next incoming message
    session.socket.resume();
  }
}

var CRLF = '\r\n';
var STATUS_CODES = exports.STATUS_CODES = {
  100 : 'Continue',
  101 : 'Switching Protocols',
  102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
  200 : 'OK',
  201 : 'Created',
  202 : 'Accepted',
  203 : 'Non-Authoritative Information',
  204 : 'No Content',
  205 : 'Reset Content',
  206 : 'Partial Content',
  207 : 'Multi-Status',               // RFC 4918
  300 : 'Multiple Choices',
  301 : 'Moved Permanently',
  302 : 'Moved Temporarily',
  303 : 'See Other',
  304 : 'Not Modified',
  305 : 'Use Proxy',
  307 : 'Temporary Redirect',
  400 : 'Bad Request',
  401 : 'Unauthorized',
  402 : 'Payment Required',
  403 : 'Forbidden',
  404 : 'Not Found',
  405 : 'Method Not Allowed',
  406 : 'Not Acceptable',
  407 : 'Proxy Authentication Required',
  408 : 'Request Time-out',
  409 : 'Conflict',
  410 : 'Gone',
  411 : 'Length Required',
  412 : 'Precondition Failed',
  413 : 'Request Entity Too Large',
  414 : 'Request-URI Too Large',
  415 : 'Unsupported Media Type',
  416 : 'Requested Range Not Satisfiable',
  417 : 'Expectation Failed',
  418 : 'I\'m a teapot',              // RFC 2324
  422 : 'Unprocessable Entity',       // RFC 4918
  423 : 'Locked',                     // RFC 4918
  424 : 'Failed Dependency',          // RFC 4918
  425 : 'Unordered Collection',       // RFC 4918
  426 : 'Upgrade Required',           // RFC 2817
  428 : 'Precondition Required',      // RFC 6585
  429 : 'Too Many Requests',          // RFC 6585
  431 : 'Request Header Fields Too Large',// RFC 6585
  500 : 'Internal Server Error',
  501 : 'Not Implemented',
  502 : 'Bad Gateway',
  503 : 'Service Unavailable',
  504 : 'Gateway Time-out',
  505 : 'HTTP Version not supported',
  506 : 'Variant Also Negotiates',    // RFC 2295
  507 : 'Insufficient Storage',       // RFC 4918
  509 : 'Bandwidth Limit Exceeded',
  510 : 'Not Extended',               // RFC 2774
  511 : 'Network Authentication Required' // RFC 6585
};


var connectionExpression = /Connection/i;
var transferEncodingExpression = /Transfer-Encoding/i;
var closeExpression = /close/i;
var chunkExpression = /chunk/i;
var contentLengthExpression = /Content-Length/i;
var dateExpression = /Date/i;
var expectExpression = /Expect/i;
var continueExpression = /100-continue/i;

var dateCache;
function utcDate() {
  if (!dateCache) {
    var d = new Date();
    dateCache = d.toUTCString();
    setTimeout(function() {
      dateCache = undefined;
    }, 1000 - d.getMilliseconds());
  }
  return dateCache;
}

function createHangUpError() {
  var error = new Error('socket hang up');
  error.code = 'ECONNRESET';
  return error;
}

function ondrain() {
  if (this._httpMessage) this._httpMessage.emit('drain');
}

function httpSocketSetup(socket) {
  socket.removeListener('drain', ondrain);
  socket.on('drain', ondrain);
}

function Server(requestListener) {
  if (!(this instanceof Server)) return new Server(requestListener);
  
  worker.Server.call(this, { allowHalfOpen: true });

  if (requestListener) {
    this.addListener('request', requestListener);
  }

  // Similar option to this. Too lazy to write my own docs.
  // http://www.squid-cache.org/Doc/config/half_closed_clients/
  // http://wiki.squid-cache.org/SquidFaq/InnerWorkings#What_is_a_half-closed_filedescriptor.3F
  this.httpAllowHalfOpen = false;

  this.addListener('connection', connectionListener);
}
util.inherits(Server, worker.Server);


exports.Server = Server;


exports.createServer = function(requestListener) {
  return new Server(requestListener);
};


function connectionListener(socket) {
  var self = this;
  var outgoing = [];
  var incoming = [];

  function abortIncoming() {
    while (incoming.length) {
      var req = incoming.shift();
      req.emit('aborted');
      req.emit('close');
    }
    // abort socket._httpMessage ?
  }

  function serverSocketCloseListener() {
    debug('server socket close');
    // mark this parser as reusable
    freeParser(parser);

    abortIncoming();
  }

  debug('SERVER new http connection');

  httpSocketSetup(socket);

  socket.setTimeout(2 * 60 * 1000); // 2 minute timeout
  socket.once('timeout', function() {
    socket.destroy();
  });

  var session = new Session(socket)
  socket.session = session
  session._headers = []
  session._url = ''
  session.onHeadersComplete = parserOnHeadersComplete
  session.onBody = parserOnBody
  session.onMessageComplete = parserOnMessageComplete

  socket.addListener('error', function(e) {
    self.emit('clientError', e);
  });

  socket.ondata = function(d, start, end) {
    // var ret = parser.execute(d, start, end - start);
    // if (ret instanceof Error) {
    //   debug('parse error');
    //   socket.destroy(ret);
    // } else if (parser.incoming && parser.incoming.upgrade) {
    //   // Upgrade or CONNECT
    //   var bytesParsed = ret;
    //   var req = parser.incoming;

    //   socket.ondata = null;
    //   socket.onend = null;
    //   socket.removeListener('close', serverSocketCloseListener);
    //   parser.finish();
    //   freeParser(parser, req);

    //   // This is start + byteParsed
    //   var bodyHead = d.slice(start + bytesParsed, end);

    //   var eventName = req.method === 'CONNECT' ? 'connect' : 'upgrade';
    //   if (self.listeners(eventName).length) {
    //     self.emit(eventName, req, req.socket, bodyHead);
    //   } else {
    //     // Got upgrade header or CONNECT method, but have no handler.
    //     socket.destroy();
    //   }
    // }
  };

  socket.onend = function() {
    var ret = parser.finish();

    if (ret instanceof Error) {
      debug('parse error');
      socket.destroy(ret);
      return;
    }

    if (!self.httpAllowHalfOpen) {
      abortIncoming();
      if (socket.writable) socket.end();
    } else if (outgoing.length) {
      outgoing[outgoing.length - 1]._last = true;
    } else if (socket._httpMessage) {
      socket._httpMessage._last = true;
    } else {
      if (socket.writable) socket.end();
    }
  };

  socket.addListener('close', serverSocketCloseListener);

  session.onIncoming = function(req) {
    incoming.push(req);

    var res = new ServerResponse(req);
    // debug('server response shouldKeepAlive: ' + shouldKeepAlive);
    // res.shouldKeepAlive = shouldKeepAlive;

    // if (socket._httpMessage) {
    //   // There are already pending outgoing res, append.
    //   outgoing.push(res);
    // }
    res.assignSocket(socket);

    // // When we're finished writing the response, check if this is the last
    // // respose, if so destroy the socket.
    // actually, one response for one session for now.
    res.on('finish', function() {
      // Usually the first incoming element should be our request.  it may
      // be that in the case abortIncoming() was called that the incoming
      // array will be empty.
      assert(incoming.length == 0 || incoming[0] === req);

      incoming.shift();

      res.detachSocket(socket);

      socket.destroySoon();
      // if (res._last) {
      //   socket.destroySoon();
      // } else {
      //   // start sending the next message
      //   var m = outgoing.shift();
      //   if (m) {
      //     m.assignSocket(socket);
      //   }
      // }
    });

    // if ('expect' in req.headers &&
    //     (req.httpVersionMajor == 1 && req.httpVersionMinor == 1) &&
    //     continueExpression.test(req.headers['expect'])) {
    //   res._expect_continue = true;
    //   if (self.listeners('checkContinue').length) {
    //     self.emit('checkContinue', req, res);
    //   } else {
    //     res.writeContinue();
    //     self.emit('request', req, res);
    //   }
    // } else {
    // }
    
    self.emit('request', req, res);
    return false; // Not a HEAD response //not really needed
  };
}
exports._connectionListener = connectionListener;

