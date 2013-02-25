

function Server(onRequest){
  this.httpAllowHalfOpen = true
  this._outgoing = []
  this._incoming = []
}

Server.prototype={
  __proto__:Worker.prototype,
}

function HttpParser(socket){
  this.socket = socket
  this._has_body = false
  this._body_length = 0
  this._body_pending = 0
  this._info = null
  this.onHeadersComplete = null
  this.onBody = null
  this.onMessageComplete = null
}

HttpParser.prototype={
  execute:function(chunk){},
  finish:function(){},
  _make_info:function(env){}
}

