
var CALL_TIMEOUT = 30000


module.exports = function(Fiber){

  function Session(fiber){
    __assert(fiber, 'no fiber passed to session')
    this.fiber = fiber
    this._done = false
    this._callTimer = 0
    this._unpacker = null
    var _this = this
    this._timeoutHandler = function(){
      __assert(!_this._done)
      _this._done = true
      var err = new Error('call timeout')
      _this.fiber.throwInto(err)
    }
    this._resetTimeout()

  }

  Session.prototype = {
    _resetTimeout: function(){
      clearTimeout(this._callTimer)
      setTimeout(this._timeoutHandler, CALL_TIMEOUT)
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
      this.fiber.run(this.result)
      this.clearTimeout(this._callTimer)
    },
    error: function(code, message) {
      __assert(!this._done)
      this._done = true
      this.clearTimeout(this._callTimer)
      var err = new Error(message)
      err.code = code
      this.fiber.thowInto(err)
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
          Fiber.yield()
        }
      }
    },
    unpacking: function(mid){
      return function(){
        var args = slice.call(arguments)
        var S = new Session(Fiber.current)
        this._sessions[S._id] = S
        this._send(mp.pack([mid, S._id, args]))
        Fiber.yield()
      }
    }
  }
}




