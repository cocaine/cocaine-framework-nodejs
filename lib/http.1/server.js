

function Server(onRequest){
  this.httpAllowHalfOpen = true
  this._outgoing = []
  this._incoming = []
}

Server.prototype={
  __proto__:Worker.prototype,
}

function connectionListener(clientSocket){
  
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
  this.onHeadersComplete = null
  this.onBody = null
  this.onMessageComplete = null
}

HTTPParser.REQUEST = 0
HTTPParser.RESPONSE = 1

HTTPParser.prototype={
  execute:function(chunk){
    if(!this._env){
      // first chunk in message
      try {
        var env = mp.unpack(chunk) //exception can be thrown
      } catch(e){
        return e
      }
      if(this._has_body = METHOD_HAS_BODY[env.REQUEST_METHOD]){
        this._body_pending =
          this._body_length = env.HTTP_CONTENT_LENGTH
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


