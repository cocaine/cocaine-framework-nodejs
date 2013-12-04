
var Worker = FSM.define({

  startState: 'closed',
  states: {
    // we start in `closed state
    closed: {
      methods: {
        connect // initiate connection to engine, state -> `connecting
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




