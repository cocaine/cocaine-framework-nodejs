

function Server(onRequest){
  this.httpAllowHalfOpen = true
  this._outgoing = []
  this._incoming = []
}

Server.prototype={
  __proto__:Worker.prototype,
}

function HTTPParser(type){
  this.socket = null
  this._has_body = false
  this._body_length = 0
  this._body_pending = 0
  this._info = null
  this.incoming = null
  this._headers = []
  this._url = ""
  this._type = type
  this.onHeaders = null  //not really used here
  this.onHeadersComplete = null
  this.onBody = null
  this.onMessageComplete = null
}

HTTPParser.REQUEST = 0
HTTPParser.RESPONSE = 1

HTTPParser.prototype={
  execute:function(chunk){},
  finish:function(){},
  _make_info:function(env){
    return {
      method:"get"
      statusCode:200,
      httpVersion:"1.1",
      versionMajor:1,
      versionMinor:1,
      shouldKeepAlive:false,
      upgrade:false,
      headers:[],
      url:"/some/path"
    }
  },
  reinitialize:notImplemented
}


