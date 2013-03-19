
var Stream = require("stream")
var EventEmitter = require("events").EventEmitter
var __assert = require("assert")
var mp = require("msgpack")

var net = require("../net")
var IncomingMessage = require("./incomingmessage")
var ServerResponse = require("./serverresponse")
var END_OF_FILE = {}

var nop = function(){}
var notImplemented = function(){
  throw new Error("not implemented")}

var debug=function(x){
  console.error("HTTP: %s",x)}

function Server(requestListener){
  if(!(this instanceof Server)){
    return new Server(requestListener)}
  net.Server.call(this,{allowHalfOpen:true})
  
  this.httpAllowHalfOpen = true
  this._outgoing = []
  this._incoming = []

  if(requestListener){
    this.on("request",requestListener)}
  this.httpAllowHalfOpen = true
  this.on("connection",connectionListener)
}

Server.prototype={
  __proto__:net.Server.prototype,
}

function createServer(requestListener){
  return new Server(requestListener)
}

function ondrain(){
  if(this._httpMessage){
    this._httpMessage.emit("drain")}
}

function connectionListener(socket){
  var self = this
  var outgoig = []
  var incoming = []

  debug("Server got http connection")

  socket.removeListener("drain",ondrain)
  socket.addListener("drain",ondrain)

  socket.setTimeout(2*60*1000)
  socket.once("timeout",function(){
    socket.destroy()})

  var parser = new HTTPParser()

  parser.socket = socket
  socket.parser = parser
  parser.incoming = null

  socket.on("error",function(e){
    self.emit("clientError",e)})

  socket.ondata = function(chunk){
    var r=parser.execute(chunk)
    if(r instanceof Error){
      debug("parse error")
      socket.destroy(r)}}

  socket.onend = function(){
    var r = parser.finish()
    if(r instanceof Error){
      debug("parse error")
      socket.destroy(r)
      return}
    if(!self.httpAllowHalfOpen){
      abortIncoming()
      if(socket.writable){
        socket.end()}}
    else if(outgoing.length){
      outgoing[outgoing.length-1]._last = true}
    else if(socket._httpMessage){
      socket._httpMessage._last = true}
    else {
      if(socket.writable){
        socket.end()}}}
  socket.addListener("close",serverSocketCloseListener)

  parser.onIncoming = function (req,shouldKeepAlive){
    incoming.push(req)
    var res = new ServerResponse(req)
    res.shouldKeepAlive = shouldKeepAlive
    res.assignSocket(socket)
    res.on("finish",function(){
      __assert(incoming.length == 0 || incoming[0] === req)
      incoming.shift()
      res.detachSocket(socket)
      if(res._last){
        socket.destroySoon()}
      else{
        __assert(0,"HTTP: more then 1 response")
      }
    })
  }
  
  function abortIncoming(){
    while(incoming.length){
      var req = incoming.shift()
      req.emit("aborted")
      req.emit("close")}}
  function serverSocketCloseListener(){
    debug("server socket close")
    freeParser(parser)
    abortIncoming()
  }
}

function freeParser(parser,req){
  if(parser){
    parser.onIncoming = null
    if(parser.socket){
      parser.socket.onend = null
      parser.socket.ondata = null
      parser.socket.parser = null}
    parser.socket = null
    parser.incoming = null}
  if(req){
    req.parser = null
  }
}

function HTTPParser(type){
  this.socket = null
  this._has_body = false
  this._body_length = 0
  this._body_pending = 0
  this._env = null
  this._info = null
  this.incoming = null
  this._headers = []
  this._url = ""
  this._type = type
  this.onHeaders = null  //not really used here
  this.onHeadersComplete = parserOnHeadersComplete
  this.onBody = parserOnBody
  this.onMessageComplete = parserOnMessageComplete

}


HTTPParser.prototype={
  execute:function(chunk){
    if(!this._env){
      // first chunk in message
      try {
        var env = mp.unpack(chunk) //exception can be thrown
      } catch(e){
        return e
      }
      console.log("==== js: environment")
      console.dir(env)
      var method = env.REQUEST_METHOD.asciiSlice().toLowerCase()
      if(this._has_body = METHOD_HAS_BODY[method]){
        this._body_pending =
          this._body_length = parseInt(env.HTTP_CONTENT_LENGTH.asciiSlice())
      }
      this._env = env
      try {
        this._info = this._make_info(env) //exception can be thrown
      } catch(e){
        return e
      }
      this.onHeadersComplete && this.onHeadersComplete(this._info)
      !this._has_body && this.onMessageComplete && this.onMessageComplete()
    } else {
      __assert(this._has_body, "data on message which has no body")
      __assert(chunk.length <= this._body_pending,
               "excess data in request")
      this._body_pending -= chunk.length
      this.onBody && this.onBody(chunk)
      if(this._body_pending === 0){
        this.onMessageComplete &&
          this.onMessageComplete()
      }
    }
  },
  finish:function(){
    //what do we check?
    __assert(this._info)
    if(this._has_body){
      __assert(this._body_pending === 0)}},
  _make_info:function(env){
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
    var headers=[]
    var host = env.SERVER_NAME.asciiSlice()
    var port = parseInt(env.SERVER_PORT.asciiSlice())
    if(port!=80){
      host+=":"+port}
    var url = env.PATH_INFO.asciiSlice()
    if(env.QUERY_STRING.length){
      url+="?"+env.QUERY_STRING.asciiSlice()}
    var method = env.REQUEST_METHOD.asciiSlice()
      .toLowerCase()
    Object.keys(env).some(function(k){
      if(k.slice(0,5)==="HTTP_"){
        headers.push(k.slice(5).replace("_","-"))
        headers.push(env[k].asciiSlice())}})
    var info = {
      method:method,
      url:url,
      httpVersion:"1.1",
      versionMajor:1,
      versionMinor:1,
      shouldKeepAlive:false,
      upgrade:false,
      headers:headers}
    return info
  },
  reinitialize:notImplemented
}

function parserOnHeadersComplete(info){
  var parser = this
  var headers = info.headers
  var url = info.url

  if(!headers){
    headers = parser._headers
    parser._headers = []
  }
  if(!url){
    url=parser._url
    parser._url = ""}
  var im = parser.incoming = new IncomingMessage(parser.socket)
  im.httpVersionMajor = info.versionMajor
  im.httpVersionMinor = info.versionMinor
  im.httpVersion = info.versionMajor+"."+info.versionMinor
  im.url = url
  var N = headers.length
  for(var i=0;i<N;i+=2){
    var k=headers[i]
    var v=headers[i+1]
    im._addHeaderLine(k,v)}
  if(info.method){
    im.method = info.method}
  im.upgrade = info.upgrade
  var skipBody = false
  skipBody = parser.onIncoming(im,info.shouldKeepAlive)
  return skipBody
}

function parserOnBody(chunk){
  var parser = this
  var im = parser.incoming // IncomingMessage
  if(im._paused || im._pendings.length){
    im._pendings.push(slice)}
  else{
    im._emitData(chunk)}
}

function parserOnMessageComplete(){
  var parser = this
  var im = parser.incoming // IncomingMessage
  im.complete = true

  var headers = parser._headers
  if(headers){
    for(var i=0,N=headers.length;i<N;i+=2){
      var k = headers[i]
      var v = headers[i+1]
      im._addHeaderLine(k,v)}
    parser._headers=[]
    parser._url = ""
  }
  if(!im.upgrade){
    if(im._paused || im._pendings.length){
      im._pendings.push(END_OF_FILE)}
    else{
      im.readable = false
      im._emitEnd()
    }
  }
  if(parser.socket.readable){
    // nothing, just:
    // parser.socket.resume()
    // which we don't really need
  }
  
}


module.exports = {
  Server:Server,
  createServer:createServer
}

var METHOD_HAS_BODY={
  post:1,
  put:1
}

