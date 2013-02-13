
/* Abstract base class for ServerRequest and ClientResponse. */
function IncomingMessage(socket) {
  Stream.call(this);

  // TODO Remove one of these eventually.
  this.socket = socket;
  this.connection = socket;

  this.httpVersion = null;
  this.complete = false;
  this.headers = {};
  this.trailers = {};

  this.readable = true;

  this._paused = false;
  this._pendings = [];

  this._endEmitted = false;

  // request (server) only
  this.url = '';

  this.method = null;

  // response (client) only
  this.statusCode = null;
  this.client = this.socket;
}
util.inherits(IncomingMessage, Stream);


exports.IncomingMessage = IncomingMessage;


IncomingMessage.prototype.destroy = function(error) {
  this.socket.destroy(error);
};


IncomingMessage.prototype.setEncoding = function(encoding) {
  var StringDecoder = require('string_decoder').StringDecoder; // lazy load
  this._decoder = new StringDecoder(encoding);
};


IncomingMessage.prototype.pause = function() {
  this._paused = true;
  this.socket.pause();
};


IncomingMessage.prototype.resume = function() {
  this._paused = false;
  if (this.socket) {
    this.socket.resume();
  }

  this._emitPending();
};


IncomingMessage.prototype._emitPending = function(callback) {
  if (this._pendings.length) {
    var self = this;
    process.nextTick(function() {
      while (!self._paused && self._pendings.length) {
        var chunk = self._pendings.shift();
        if (chunk !== END_OF_FILE) {
          assert(Buffer.isBuffer(chunk));
          self._emitData(chunk);
        } else {
          assert(self._pendings.length === 0);
          self.readable = false;
          self._emitEnd();
        }
      }

      if (callback) {
        callback();
      }
    });
  } else if (callback) {
    callback();
  }
};


IncomingMessage.prototype._emitData = function(d) {
  if (this._decoder) {
    var string = this._decoder.write(d);
    if (string.length) {
      this.emit('data', string);
    }
  } else {
    this.emit('data', d);
  }
};


IncomingMessage.prototype._emitEnd = function() {
  if (!this._endEmitted) {
    this.emit('end');
  }

  this._endEmitted = true;
};


// Add the given (field, value) pair to the message
//
// Per RFC2616, section 4.2 it is acceptable to join multiple instances of the
// same header with a ', ' if the header in question supports specification of
// multiple values this way. If not, we declare the first instance the winner
// and drop the second. Extended header fields (those beginning with 'x-') are
// always joined.
IncomingMessage.prototype._addHeaderLine = function(field, value) {
  var dest = this.complete ? this.trailers : this.headers;

  field = field.toLowerCase();
  switch (field) {
    // Array headers:
    case 'set-cookie':
      if (field in dest) {
        dest[field].push(value);
      } else {
        dest[field] = [value];
      }
      break;

    // Comma separate. Maybe make these arrays?
    case 'accept':
    case 'accept-charset':
    case 'accept-encoding':
    case 'accept-language':
    case 'connection':
    case 'cookie':
    case 'pragma':
    case 'link':
    case 'www-authenticate':
    case 'proxy-authenticate':
    case 'sec-websocket-extensions':
    case 'sec-websocket-protocol':
      if (field in dest) {
        dest[field] += ', ' + value;
      } else {
        dest[field] = value;
      }
      break;


    default:
      if (field.slice(0, 2) == 'x-') {
        // except for x-
        if (field in dest) {
          dest[field] += ', ' + value;
        } else {
          dest[field] = value;
        }
      } else {
        // drop duplicates
        if (!(field in dest)) dest[field] = value;
      }
      break;
  }
};


