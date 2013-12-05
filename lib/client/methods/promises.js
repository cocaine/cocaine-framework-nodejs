
var CALL_TIMEOUT = 30000


module.exports = function(Promise) {
  
  function Session(deferred){
    __assert(deferred, 'no deferred passed to session')
    this.deferred = Promise.defer()
    var _this = this
    this._done = false
    this._callTimer = 0
    this._unpacker = null
    this._timeoutHandler = function(){
      __assert(!_this._done)
      _this._done = true
      var err = new Error('call timeout')
      Promise.reject(_this.deferred, err)
    }
    this._resetTimeout()
  }

  Session.prototype = {
    _resetTimeout: function(){
      clearTimeout(this._callTimer)
      this._callTimersetTimeout(this._timeoutHandler, CALL_TIMEOUT)
    },
    chunk: function(chunk){
      __assert(this.chunk === undefined)
      this.chunk = chunk
      var unpacker = this._unpacker || mp.unpack
      this._result = unpacker(chunk)
    },
    choke: function(){
      __assert(!this._done)
      this._done = true
      Promise.fulfill(this.deferred, this.result)
      this.clearTimeout(this._callTimer)
    },
    error: function(code, message) {
      __assert(!this._done)
      this._done = true
      this.clearTimeout(this._callTimer)
      var err = new Error(message)
      err.code = code
      Promise.reject(this.deferred, err)
    }
  }

  return {
    unpackWith: function(unpacker){
      return function(mid){
        return function(){
          var args = slice.call(arguments)
          var S = new Session()
          S._unpacker = unpacker
          this._sessions[S._id] = S
          this._send(mp.pack([mid, S._id, args]))
          return Promise.promise(S.deferred)
        }
      }
    },
    unpacking: function(mid){
      return function(){
        var args = slice.call(arguments)
        var S = new Session()
        this._sessions[S._id] = S
        this._send(mp.pack([mid, S._id, args]))
        return Promise.promise(S.deferred)
      }
    }
  }
}


