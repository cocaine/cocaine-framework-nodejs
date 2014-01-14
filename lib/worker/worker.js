
var EventEmitter = require('events').EventEmitter
var mp = require('msgpack')
var __assert = require('assert')

var util = require('../util')
var _ = require('../errno'), ERRNO = _.errno, _ERRNO = _.code
var _ = require('../protocol'), RPC = _.RPC, _RPC = _._RPC, TERMINATE = _.TERMINATE

var FSM = require('../fsm')

var Session = require('../session').Session
var ListenHandle = require('./handles').ListenHandle

// FIXME: such a bizarre naming is a source of confusion and misunderstanding
var channel_binding = require('bindings')('nodejs_cocaine_framework').communicator

var trace = 0

var Worker = FSM.define({

  methods:{
    __init__: function(options) {
      this._endpoint = options.endpoint // '/path/to/unix.sock'
      this._uuid = options.uuid
      this._app = options.app

      this._listenHandles = {}
      this._sessions = {}

      this.events = new EventEmitter()

      this._disownTimeout = options.disownTimeout || 30000
      this._heartbeatInterval = options.heartbeatInterval || 5000

      this._heartbeatTimer = 0
      this._disownTimer = 0

      this._handlers = {}
      util.bindHandlers(this.handlers, this._handlers, this)
    },

    ListenHandle: function(event){
      var lh = new ListenHandle(event, this)
      return lh
    },
    
    Session: function(event){
      var s = new Session()
      s.owner = this
      return s
    },
    
    listen: function(){
      if(this._state === 'closed'){
        this.connect(this._endpoint)
      }
    },

    getListenHandle:function(event){
      __assert((typeof event === 'string' || typeof event === 'number')
               && !(event in this._listenHandles),
               "(typeof event === 'string' || typeof event === 'number')"+
               " && !(event in this._listenHandles)")
      var lh = this.ListenHandle(event)
      return this._listenHandles[lh._id] = lh
    },

    removeListenHandle:function(lh){
      __assert(this._listenHandles[lh._id] === lh)
      delete this._listenHandles[lh._id]
    },

    ref:function(){
      //this._handle.ref()
    },

    unref:function(){
      //this._handle.unref()
    },

    _resetDisownTimer: function(){
      clearTimeout(this._disownTimer)
    },

    _resetTimers: function(){
      clearTimeout(this._disownTimer)
      clearTimeout(this._heartbeatTimer)
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

  handlers: {
    disown: function(){
      __assert(this._state === 'connected')
      this.events.emit('disown')
      this.close()
    },
    
    sendNextHeartbeat: function(){
      __assert(this._state === 'connected', "this._state === 'connected'")
      this._handle.send(mp.pack([RPC.heartbeat, 0, []]))
      this._heartbeatTimer = setTimeout(this._handlers.sendNextHeartbeat, this._heartbeatInterval)
    }
  },

  startState: 'closed',
  states: {
    // we start in a `closed state
    closed: {
      methods: {
        // initiate connection to engine, state -> `connecting
        connect: function(endpoint){
          trace && console.log('connect', arguments)
          endpoint = endpoint || this._endpoint
          if(Array.isArray(endpoint)){
            __assert(typeof endpoint[0] === 'string' && typeof endpoint[1] === 'number', "endpoint is ['host|ip', port]")
            this._setHandle(new channel_binding(endpoint[0], endpoint[1]))
          } else {
            __assert(typeof endpoint === 'string', "assume endpoint is a string path to unix socket")
            this._setHandle(new channel_binding(endpoint))
          }
          this._setState('connecting')
        }
      }
    },

    // wait for the socket to connect
    connecting: {
      methods:{
        // cancel initiated in-progress connection, state -> `closed
        close: function(){
          this._closeHandle()
          this._resetTimers()
          this._setState('closed')
        }
      },
      handlers:{
        // connection established; send `handshake, state -> `connected
        on_connect: function(){
          var _this = this.owner
          _this._handle.send(mp.pack([RPC.handshake, 0, [_this._uuid]]))
          _this._setState('connected')
          _this._handlers.sendNextHeartbeat()
          _this.events.emit('connect')
        },
        
        // connection attempt failed. state -> `closed
        on_socket_error: function(errno){
          var _this = this.owner
          _this._closeHandle()
          _this._setState('closed')
          var e = util.makeError(errno)
          _this.events.emit('error',e)
        }
      }
    },

    // connection established, handshaked, and first heartbeat sent.
    // wait for incoming requests messages
    connected:{
      methods:{
        // js app wants worker to shut down, for some good or bad reason
        terminate: function(normal, reason){
          var state = normal? TERMINATE.normal: TERMINATE.abnormal
          var msg = mp.encode([RPC.terminate, 0, [state, reason]])
          this._handle.send(msg)
          this._setState('selfTerminated')
        },
        
        // app just closes the engine socket. engine won't
        // accept any messages from thisworker instance (i.e. after
        // reconnect) anymore
        close: function(){
          // TODO: shouldn't we just call .terminate here?
          this._closeHandle()
          this._setState('closed')
          this._resetTimers()
          this._resetSessions(ERRNO.ECONNRESET)
        }
      },

      handlers:{
        // unexpected socket-level failure
        on_socket_error: function(errno){
          var _this = this.owner
          trace && console.log('socket error <%s>', _this._name, _ERRNO[errno])
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
          _this.events.emit('error', util.makeError(errno))
        },
        
        // got a `heartbeat message from engine
        on_heartbeat: function(){
          var _this = this.owner
          _this._resetDisownTimer()
        },
        
        // `terminate message
        on_terminate: function(sid, code, reason){
          var _this = this.owner
          _this._resetTimers()
          _this._setState('engineTerminated')
        },
        
        // `invoke message for new session
        on_invoke: function(sid, event){
          trace && console.log('on_invoke sss', sid, event)
          var _this = this.owner
          var lh = _this._listenHandles[event]
          if(lh){
            trace && console.log('got listen handle')
            var s = lh.createStreamHandle(sid, event)
            _this._sessions[s._id] = s
          } else {
            var s = _this.Session()
            s._id = sid
            _this._sessions[s._id] = s
            _this.emit(event, s)
          }
        },
        
        // `chunk message for some session
        on_chunk: function(sid, data){
          trace && console.log('on_chunk', sid, data)
          var _this = this.owner
          var s = _this._sessions[sid]
          if(s){
            s.pushChunk(data)
          }
        },
        
        // `choke message for some session
        on_choke: function(sid){
          trace && console.log('on_choke', sid)
          var _this = this.owner
          var s = _this._sessions[sid]
          if(s){
            s.pushChoke()
            delete _this._sessions[sid]
          }
        },
        
        // `error message for some session
        on_error: function(sid, code, message){
          trace && console.log('on_error', sid, code, message)
          var _this = this.owner
          var s = _this._sessions[sid]
          if(s){
            s.pushError(code, msg)
            delete s._sessions[sid]
          }
        }
      }
    },

    // got `terminate from engine
    engineTerminated: {
      methods:{
        // tell engine that js app shutdown is complete, state -> `terminated
        terminate: function(){
          this._handle.send(msg)
          this._setState('terminated')
          this._resetSessinos(ERRNO.ESHUTDOWN)
        },
        
        // just drop the connection
        close: function(){
          // TODO: shouldn't we just call .terminate here?
          this._closeHandle()
          this._setState('closed')
          this._resetTimers()
          this._resetSessions(ERRNO.ECONNRESET)
        }
      },
      handlers:{
        // after `terminate message from engine we don't expect any
        // other messages
        
        // engine didn't make it to receive our
        // `terminate response and closed the socket beforehand
        on_socket_error: function(errno){
          var _this = this.owner
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
          _this.events.emit('error', e)
        }
      }
    },

    // .terminate() was called, because js app wants worker to shut down
    selfTerminated: {
      methods:{
        // don't wait for `terminate reply, just drop the connection
        close:function(){
          this._closeHandle()
          this._setState('closed')
          this._resetSessions(ERRNO.ECONNRESET)
        }
      },
      handlers:{
        // socket-level error
        on_socket_error: function(errno){
          var _this = this.owner
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
          _this.events.emit('error', e)
        },
        
        // engine responds with `treminate, state->`closed
        on_terminate: function(sid, code, reason){
          var _this = this.owner
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(ERRNO.ESHUTDOWN)
        }
      }
    },

    // final termination phase, when we got 'terminate' from engine,
    // sent it 'terminate' in response, and waiting for socket to
    // shutdown
    terminated: {
      methods:{
        // drop the connection. In this case it may happen that our
        // `terminate message won't make it through to engine
        close: function(){
          this._closeHandle()
          this._setState('closed')
          this._resetSessions(ERRNO.ECONNRESET)
        }
      },
      handlers:{
        // engine shut down the socket as expected
        on_socket_error: function(errno){
          var _this = this.owner
          // TODO: if(errno === ERRNO.ESHUTDOWN)
          _this._closeHandle()
          _this._setState('closed')
          _this._resetSessions(errno)
          _this.events.emit('error', e)
        }
      }
    }
    
    
  }
  
})

module.exports = {
  Worker: Worker
}




