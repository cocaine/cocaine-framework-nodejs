
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
  var outgoing = []
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
    self.emit("request",req,res)
    return false
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
    try{
      var req = mp.unpack(chunk)
    } catch(e){
      return e
    }
    console.log("==== js: request")
    console.dir(req)
    var method = req.meta.method
    this._has_body = METHOD_HAS_BODY[method]
    this._req = req
    this._info = this._make_info(req)
    this.onHeadersComplete && this.onHeadersComplete(this._info)
    if(this._has_body && this.onBody){
      var b=new Buffer(req.request,"ascii")
      this.onBody(b)}
    this.onMessageComplete()
  },
  finish:function(){
    //what do we check?
    __assert(this._req)},
  _make_info:function(env){
    // var env = { meta: 
    //   { secure: false,
    //     url: 'http://host.net?soijdofijsf=oaijdsfoijs&siodf=123',
    //     host: 'host.net',
    //     method: 'GET',
    //     query_string: 'soijdofijsf=oaijdsfoijs&siodf=123',
    //     remote_addr: '141.8.175.120',
    //     server_addr: '93.158.130.138',
    //     path_info: '',
    //     script_name: '',
    //     headers: 
    //     { ACCEPT: '*/*',
    //       'USER-AGENT': 'curl/7.27.0',
    //       HOST: 'host.net',
    //       'CONTENT-TYPE': '' },
    //     cookies: {} },
    //   request: { siodf: '123', soijdofijsf: 'oaijdsfoijs' } }
    
    var headers=[]
    var host = env.meta.host
    var port = 80 // fixme
    if(port!=80){
      host+=":"+port}
    var url = env.meta.url
    var method = env.meta.method
    var hh = env.meta.headers
    Object.keys(hh).some(function(k){
      headers.push(k.toLowerCase())
      headers.push(hh[k])})
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

  console.log("==== js: incoming http message headers")

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

  console.log("==== js: incoming http message body chunk")

  if(im._paused || im._pendings.length){
    im._pendings.push(chunk)}
  else{
    im._emitData(chunk)}
}

function parserOnMessageComplete(){
  var parser = this
  var im = parser.incoming // IncomingMessage
  im.complete = true

  console.log("==== js: incoming http message complete")

  var headers = parser._headers
  if(headers){
    for(var i=0,N=headers.length;i<N;i+=2){
      var k = headers[i]
      var v = headers[i+1]
      im._addHeaderLine(k,v)}
    parser._headers=[]
    parser._url = ""
  }
  console.log("==== js: im.upgrade", im.upgrade)
  if(!im.upgrade){
    if(im._paused || im._pendings.length){
      im._pendings.push(END_OF_FILE)}
    else{
      console.log("==== js: emitting http.end")
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
  POST:1,
  put:1,
  PUT:1
}

