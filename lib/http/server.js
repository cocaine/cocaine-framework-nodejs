
module.exports={
  Server:Server,
  createServer:createServer,
  _connectionListener:_connectionListener
}

function Server(requestListener) {
  if (!(this instanceof Server)) {
    return new Server(requestListener)}
  
  worker.Server.call(this, workerHandle);

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

function createServer(requestListener) {
  return new Server(requestListener);
};




function ondrain() {
  if (this._httpMessage) this._httpMessage.emit('drain');
}

function httpSocketSetup(socket) {
  socket.removeListener('drain', ondrain);
  socket.on('drain', ondrain);
}

function connectionListener(sock) {
  var self = this;
  var outgoing = [];
  var incoming = [];

  function abortIncoming() {
    while (incoming.length) {
      var req = incoming.shift()
      req.emit('aborted')
      req.emit('close')}
    /* abort socket._httpMessage ? */}
  function serverSocketCloseListener() {
    debug('server socket close')
    //freeParser(parser);
    abortIncoming()}
  //debug('SERVER new http connection');
  httpSocketSetup(socket);

  sock.setTimeout(2 * 60 * 1000); // 2 minute timeout
  sock.once('timeout', function() {
    sock.destroy()})

  var parser = new Parser(sock)
  sock.parser = parser
  parser._headers = []
  parser._url = ''
  parser.onHeadersComplete = parserOnHeadersComplete
  parser.onBody = parserOnBody
  parser.onMessageComplete = parserOnMessageComplete

  sock.addListener('error', function(e) {
    self.emit('clientError', e)})

  sock.ondata = function(chunk){
    var ret = _try1(parser,parser.execute,chunk)
    if (ret instanceof Error) {
      debug('parse error')
      socket.destroy(ret)}}

  sock.onend = function() {
    var ret = _try0(parser,parser.finish)
    if (ret instanceof Error) {
      debug('parse error')
      socket.destroy(ret)
      return}
    if (!self.httpAllowHalfOpen) {
      abortIncoming()
      if (socket.writable){
        sock.end()}}
    else if (outgoing.length) {
      outgoing[outgoing.length - 1]._last = true}
    else if (sock._httpMessage) {
      sock._httpMessage._last = true}
    else {
      if (sock.writable) sock.end()}}

  sock.addListener('close', serverSocketCloseListener);

  parser.onIncoming = function(req) {
    assert(incoming.length===0)
    incoming.push(req);
    var res = new ServerResponse(req)
    // debug('server response shouldKeepAlive: ' + shouldKeepAlive);
    // res.shouldKeepAlive = shouldKeepAlive;
    assert(outgoing.length===0)
    // if (socket._httpMessage) {
    //   // There are already pending outgoing res, append.
    //   outgoing.push(res);
    // }
    res.assignSocket(socket)
    // // When we're finished writing the response, check if this is the last
    // // respose, if so destroy the socket.
    // actually, one response for one session for now.
    res.on('finish', function() {
      assert(incoming.length == 0
             || incoming[0] === req)
      incoming.shift()
      res.detachSocket(socket)
      socket.destroySoon()})
    self.emit('request', req, res)}
}

function parserOnHeadersComplete(info) {
  var parser = this;
  var headers = info.headers;
  var url = info.url;

  parser.incoming = new IncomingMessage(parser.socket);
  parser.incoming.httpVersionMajor = info.versionMajor;
  parser.incoming.httpVersionMinor = info.versionMinor;
  parser.incoming.httpVersion = info.versionMajor + '.' + info.versionMinor;
  parser.incoming.url = url;

  var n = headers.length;

  for (var i = 0; i < n; i++) {
    var k = headers[i][0];
    var v = headers[i][1];
    parser.incoming._addHeaderLine(k, v);
  }

  parser.incoming.method = info.method;

  //parser.incoming.upgrade = info.upgrade;

  parser.onIncoming(parser.incoming);
}

function parserOnBody(chunk) {
  var parser = this;
  if (parser.incoming._paused || parser.incoming._pendings.length) {
    parser.incoming._pendings.push(chunk)}
  else {
    parser.incoming._emitData(chunk)}
}

function parserOnMessageComplete() {
  var parser = this;
  parser.incoming.complete = true;
  if (parser.incoming._paused || parser.incoming._pendings.length) {
    parser.incoming._pendings.push(END_OF_FILE)}
  else {
    parser.incoming.readable = false
    parser.incoming._emitEnd()}
  //what is state of socket here?
}


function Parser(sock){
  this.socket=sock
  sock.ondata=this._on_data.bind(this)
  sock.onend=this._on_end.bind(this)
}

Parser.prototype={
  finish:function(){
    assert(this._info)
    if(this._has_body){
      assert(this._body_pending===0)}},
  execute:function(chunk){
    if(!this._info){
      var env=mp.unpack(chunk)
      this._has_body=METHOD_HAS_BODY[env.REQUEST_METHOD]
      if(this._has_body){
        this._body_length=env.HTTP_CONTENT_LENTGH
        this._body_pending=this._body_length}
      this._info=this._make_info(env)
      this.onHeadersComplete && this.onHeadersComplete(this._info)
      if(!this._has_body){
        this.onMessageComplete && this.onMessageComplete()}}
    else{
      assert(this._has_body,"data on message which should have no body")
      assert(chunk.length<=this._body_pending,
             "excess data in request")
      this._body_pending -= chunk.length
      this.onBody && this.onBody(chunk)
      if(this._body_pending===0){
        this.onMessageComplete &&
          this.onMessageComplete()}}},
  _make_info:function(env){
    var headers={}
    for(var k0 in env){
      if(k0.slice(0,5)==="HTTP_"){
        var k1=k0.slice(5)
        headers[k1]=env[k0].asciiSlice()}}
    var p0=
    assert(p0.slice(0,6)==="HTTP/")
    var _=env.SERVER_PROTOCOL
      .slice(6).split(".")
    var major=_[0],minor=_[1]
    return {
      headers:headers,
      url:env.PATH_INFO.asciiSlice()+"?"+env.QUERY_STRING,
      versionMajor:major,
      versionMinor:minor}}
}

// var ENV_MAP={
//   HTTP_ACCEPT: <Buffer 2a 2f 2a>,
//   HTTP_HOST: <Buffer 64 65 61 6c 65 72 30 31 67 2e 64 65 76 2e 79 61 6e 64 65 78 2e 6e 65 74 3a 38 30 38 30>,
//   HTTP_USER_AGENT: <Buffer 63 75 72 6c 2f 37 2e 32 37 2e 30>,
//   PATH_INFO: <Buffer 2f 68 61 73 68>,
//   QUERY_STRING: <Buffer 6e 3d 32>,
//   REMOTE_ADDR: <Buffer 31 34 31 2e 38 2e 31 37 35 2e 31 32 30>,
//   REMOTE_PORT: <Buffer 33 35 33 32>,
//   REQUEST_METHOD: <Buffer 47 45 54>,
//   SCRIPT_NAME: <Buffer >,
//   SERVER_NAME: <Buffer 64 65 61 6c 65 72 30 31 67 2e 64 65 76 2e 79 61 6e 64 65 78 2e 6e 65 74>,
//   SERVER_PORT: <Buffer 38 30 38 30>,
//   SERVER_PROTOCOL: <Buffer 48 54 54 50 2f 31 2e 31> }


function _try0(self,fn){
  try{
    return fn.call(self)}
  catch(e){
    return e}}

function _try1(self,fn,arg0){
  try{
    return fn.call(self,arg0)}
  catch(e){
    return e}}

