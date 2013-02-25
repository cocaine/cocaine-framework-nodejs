

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




  static Handle<Value> Finish(const Arguments& args) {
    HandleScope scope;

    Parser* parser = ObjectWrap::Unwrap<Parser>(args.This());

    assert(!current_buffer);
    parser->got_exception_ = false;

    int rv = http_parser_execute(&(parser->parser_), &settings, NULL, 0);

    if (parser->got_exception_) return Local<Value>();

    if (rv != 0) {
      enum http_errno err = HTTP_PARSER_ERRNO(&parser->parser_);

      Local<Value> e = Exception::Error(String::NewSymbol("Parse Error"));
      Local<Object> obj = e->ToObject();
      obj->Set(String::NewSymbol("bytesParsed"), Integer::New(0));
      obj->Set(String::NewSymbol("code"), String::New(http_errno_name(err)));
      return scope.Close(e);
    }

    return Undefined();
  }

