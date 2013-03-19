
var OutgoingMessage = require("./outgoingmessage")
var nop = function(){}
var notImplemented = function(){
  throw new Error("not implemented")}

function ServerResponse(){
  this.socket = null
  this.connection = null
  this._expect_continue = false
  this._sent100 = false
  this.shouldKeepAlive = false
  this._hasBody = true
  this.statusCode = 200
}

ServerResponse.prototype={
  __proto__:OutgoingMessage.prototype,
  
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

  writeHead:function(statusCode /*[,reasonPhrase] [,headers]*/){
    //normalize arguments
    var reasonPhrase, headers, hi
    if(typeof arguments[1] === "string"){
      reasonPhrase = arguments[1]
      hi = 2
    } else {
      reasonPhrase = STATUS_CODES[statusCode]
      hi = 1
    }
    this.statusCode = statusCode
    
    //generate (render) headers tuple
    var hh=arguments[hi]
    if(hh && this._headers){
      headers = this._renderHeaders()
      if(Array.isArray(hh)){
        var field
        for(var i=0,len=hh.length;i<len;i++){
          field = hh[i][0]
          if(field in headers){
            hh.push([field,headers[field]])}}
        headers = hh}
      else {
        var keys = Object.keys(hh)
        for(var i=0;i<keys.length;i++){
          var k = keys[i]
          if(k){
            headers[k] = hh[k]}}}}
    else if(this._headers){
      headers = this._renderHeaders()}
    else{
      headers = hh}
    
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
    this.shouldKeepAlive = false;

    //remember, we don't actually write here:
    this._storeHeader(null,headers)
  },
  writeHeader:function(){
    this.writeHead.apply(this,arguments)},

  _implicitHeader:function(){
    this.writeHead(this.statusCode)
  }
}

function onServerResponseClose() {
  if (this._httpMessage) this._httpMessage.emit('close');
}

module.exports = ServerResponse

