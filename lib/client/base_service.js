
var __assert = require('assert')

var channel_binding = require('../channel/channel').Channel
var _ = require('../errno'), ERRNO = _.errno, _ERRNO = _.code
var FSM = require('../fsm')
var mp = require('msgpack')

var util = require('../util')

var makeError = util.makeError

var trace = 0

var BaseService = FSM.define({

  methods:{
    __init__: function(){
      this._sessions = {}
    },
    callSession: function(session){
      session._id = this.__sid++
      session._owner = this
      this._sessions[session._id] = session
      this.send([session._methodId, session._id, session._args])
    },
    _send: function(message){
      var buf = mp.pack(message)
      this._handle.send(buf)
    },
    _setHandle: function(handle){
      this._handle = handle
      handle.owner = this
    },
    _closeHandle: function(){
      this._handle.close()
      util.unsetHandlers(this._handle, this.__fsmdef[this._state].handlers)
      this._handle.owner = null
      this._handle = null
    },
    _resetSessions: function(errno){
      Object.keys(this._sessions).forEach(function(sid){
        var s = this._sessions[sid]
        s.pushError(errno, _ERRNO[errno])
        delete this._sessions[sid]
      },this)
    },
    _clearSessions: function(){
      var ss = this._sessions
      this._sessions = {}
      Object.keys(ss).some(function(k){
        ss[k].reset()
      })
      return ss
    }
  },

  startState: 'closed',
  states:{

    closed:{
      invariant: function(){return this._handle === null},
      methods:{
        connect: function(endpoint){
          trace && console.log('connecting to', endpoint)
          if(Array.isArray(endpoint)){
            __assert(typeof endpoint[0] === 'string' && typeof endpoint[1] === 'number',
                     "endpoint is ['host|ip', port]")
            var channelHandle = new channel_binding(endpoint[0], endpoint[1])
            this._setHandle(channelHandle)
          } else {
            __assert(typeof endpoint === 'string', "assume endpoint is a string path to a unix socket")
            var channelHandle = new channel_binding(endpoint)
            this._setHandle(channelHandle)
          }
          this._setState('connecting')
        }
      }
    },


    connecting:{
      invariant: function(){return this._handle !== null},
      methods:{
        close:function(){
          this._closeHandle()
          this._setState('closed')
        }
      },

      handlers:{
        on_socket_error:function(errno){
          trace && console.log('on_socket_error', errno)
          var _this  = this.owner
          var e = makeError(errno)
          _this._emit('error', e)
          _this._closeHandle()
          _this._resetSessions(errno)
          _this._setState('closed')
        },

        on_connect:function(){
          var _this  = this.owner
          _this._setState('connected')
          _this._emit('connect')
        }
      }
    },
    
    connected:{
      invariant: function(){return this._handle !== null},
      methods:{
        send:function(msg){
          this._send(msg)
        },

        close:function(){
          this._closeHandle()
          this._setState('closed')
          this._resetSessions(ERRNO.ECONNRESET)
        }
      },

      handlers:{
        on_socket_error:function(errno){
          var _this  = this.owner
          trace && console.log('socket error <%s>', _this._name, _ERRNO[errno])
          var e = makeError(errno)
          _this._emit('error', e)
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
        },

        on_chunk: function(sid, chunk){
          var _this  = this.owner
          var s = _this._sessions[sid]
          if(s){
            s.pushChunk(chunk)
          }
        },

        on_choke: function(sid){
          trace && console.log('choke',sid)
          var _this  = this.owner
          var s = _this._sessions[sid]
          if(s){
            delete _this._sessions[sid]
            s.pushChoke()
          }
        },

        on_error: function(sid, code, message){
          trace && console.log('error',sid, code, message)
          var _this  = this.owner
          var s = _this._sessions[sid]
          if(s){
            delete _this._sessions[sid]
            s.pushError(code, message)
          }
        }
      }
    }
    
  }
})


module.exports = {
  BaseService: BaseService
}


