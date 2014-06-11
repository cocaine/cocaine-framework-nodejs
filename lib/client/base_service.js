
var __assert = require('assert')

//var channel_binding = require('bindings')('nodejs_cocaine_framework').communicator
var channel_binding = require('../channel/channel').communicator
var _ = require('../errno'), ERRNO = _.errno, _ERRNO = _.code
var FSM = require('../fsm')
var mp = require('msgpack')

var util = require('../util')

var makeError = util.makeError

var trace = 0

var BaseService = FSM.define({

  methods:{
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
    }
  },

  startState: 'closed',
  states:{

    closed:{
      invariant: function(){return this._handle === null && this._error === null},
      methods:{
        connect: function(endpoint){
          trace && console.log('connecting to', endpoint)
          if(Array.isArray(endpoint)){
            __assert(typeof endpoint[0] === 'string' && typeof endpoint[1] === 'number', "endpoint is ['host|ip', port]")
            try{
              var channelHandle = new channel_binding(endpoint[0], endpoint[1])
            } catch (e){
              if(typeof e === 'number'){
                e = new Error(_ERRNO[e])
              }
              throw e
            }
            this._setHandle(channelHandle)
          } else {
            __assert(typeof endpoint === 'string', "assume endpoint is a string path to unix socket")
            try{
              var channelHandle = new channel_binding(endpoint)
            } catch(e){
              if(typeof e === 'number'){
                e = new Error(_ERRNO[e])
              }
              throw e
            }
            this._setHandle(channelHandle)
          }
          this._setState('connecting')
        }
      }
    },


    connecting:{
      invariant: function(){return this._handle !== null && this._error === null},
      methods:{
        close:function(){
          this._closeHandle()
          this._setState('closed')
        }
      },

      handlers:{
        on_socket_error:function(errno){
          var _this  = this.owner
          _this._closeHandle()
          var e = makeError(errno)
          _this._error = e
          _this._setState('error')
          _this._resetSessions(errno)
          _this._emit('error', e)},

        on_connect:function(){
          var _this  = this.owner
          _this._setState('connected')
          _this._emit('connect')
        }
      }
    },
    
    connected:{
      invariant: function(){return this._handle !== null && this._error === null},
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
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
          _this._emit('error', e)
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
    },
    
    error:{
      methods:{
        invariant: function(){return this._handle === null && this._error === null},
        close:function(){
          this._error = null
          this._setState('closed')
        }
      }
    }

  }
})


module.exports = {
  BaseService: BaseService
}


