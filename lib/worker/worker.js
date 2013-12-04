
var mp = require('msgpack')

var util = require('../util')
var _ = require('../errno'), ERRNO = _.errno, _ERRNO = _.code
var _ = require('../protocol'), RPC = _.RPC, _RPC = _._RPC, TERMINATE = _.TERMINATE

var FSM = require('../fsm')

var Session = require('./session').Session
var ListenHandle = require('./handles').ListenHandle

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

    _resetDisownTimer: function(){
      clearTimeout(this._disownTimer)
    },

    _resetTimers: function(){
      clearTimeout(this._disownTimer)
      clearTimeout(this._heartbeatTimer)
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
      this._handle.send([mp.pack(RPC.heartbeat, 0, [])])
      this._heartbeatTimer = setTimeout(this._handlers.sendNextHeartbeat, this._heartbeatTimeout)
    }
  },

  startState: 'closed',
  states: {
    // we start in `closed state
    closed: {
      methods: {
        // initiate connection to engine, state -> `connecting
        connect: function(endpoint){
          trace && console.log('connecting to', endpoint)
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

    // wait for socket to connect
    connecting: {
      methods:{
        close // cancel initiated in-progress connection, state -> `closed
        _handshake // helper to send `handshake message
      }
      handlers:{
        on_connect // connection established; send `handshake, state
        // -> `connected
        
        on_socket_error // connection attempt fail. state -> `closed
      }
    },

    // socket connected, handshake and first heartbeat sent.
    // wait for incoming requests messages
    connected:{
      methods:{
        terminate // js app wants worker to shut down, for some good
        // or bad reason
        
        close // app just closes the engine socket. engine won't
        // accept any messages from thisworker instance (i.e. after
        // reconnect) anymore
      }

      handlers:{
        on_socket_error // unexpected socket-level failure
        on_heartbeat // got a `heartbeat message from engine
        on_terminate // `terminate message
        
        on_invoke // `invoke message for new session
        on_chunk // `chunk message for some session
        on_choke // `choke message for some session
        on_error // `error message for some session
      }
    }

    // got `terminate from engine
    engineTerminated: {
      methods:{
        terminate // tell engine that js app shutdown is complete,
        // state -> `terminated
        
        close // just drop the connection
      }
      handlers:{
        // after `terminate message from engine we don't expect any
        // other messages
        
        on_socket_error // engine didn't made it to receive our
        // `terminate response and closed the socket
      }
    }

    // .terminate() was called, because js app wants worker to shut down
    selfTerminated: {
      methods:{
        close // don't wait for `terminate reply, just drop the connection
      }
      handlers:{
        on_socket_error // socket-level error
        on_terminate // engine responds with `treminate, state->`closed
      }
    }

    // final termination phase, when we got 'terminate' from engine,
    // sent it 'terminate' in response, and waiting for socket to
    // shutdown
    terminated: {
      methods:{
        close // drop the connection. In this case it may happen that our
        // `terminate message won't make it through to engine
      }
      handlers:{
        on_socket_error // engine shut down the socket
      }
    }
    
    
  }
  
})

module.exports = {
  Worker: Worker
}




