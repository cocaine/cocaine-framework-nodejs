
var net = require('net')
var mp = require('msgpack')
var fs = require('fs')

var errno = require('../lib/errno').errno
var RPC = require('../lib/protocol').RPC

var __assert = require('assert')

var Channel = require('../lib/channel/channel').Channel


describe('channel', function(){

  describe('connection functions', function(){
    
    it('connects to tcp endpoint', function(done){
      var port = 12345
      var conn
      
      var n = 0
      function signal(){
        if(++n === 2){
          conn.destroy()
          ch.close()
          S.close()
          done()
        }
      }

      var S = net.createServer(function(conn0){
        conn = conn0
        signal()
      })

      S.listen(port, function(){
        ch = new Channel('localhost', port)
        ch.on_connect = function(){
          signal()
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
      })

    })
    

    it('connects to unix socket', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn
      
      var n = 0
      function signal(){
        if(++n === 2){
          conn.destroy()
          ch.close()
          S.close()
          done()
        }
      }

      var S = net.createServer(function(conn0){
        conn = conn0
        signal()
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          signal()
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
      })

    })

    it('sends', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn

      var N = 1024*1024
      var b = new Buffer(N)
      for(var i=0;i<N;i++){
        b[i] = i
      }
      
      function finalize(){
        conn.destroy()
        ch.close()
        S.close()
        done()
      }

      var result = []
      var len = 0

      var S = net.createServer(function(conn0){
        conn = conn0
        conn.on('data', function(data){
          result.push(data)
          len += data.length
          if(len === N){
            var b1 = Buffer.concat(result)
            for(var i=0;i<N;i++){
              __assert(b1[i] === (i&0xff), 'b1[i] === (i&0xff)')
            }
            finalize()
          }
        })
        
        conn.on('error', function(err){
          done(err)
        })
        
        conn.on('end', function(){
          done(new Error('end encountered'))
        })
        
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          ch.send(b)
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
      })
    })

    it('closes', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn

      var N = 1024*1024
      var b = new Buffer(N)
      for(var i=0;i<N;i++){
        b[i] = i
      }
      
      function finalize(){
        conn.destroy()
        S.close()
        done()
      }

      var result = []
      var len = 0

      var S = net.createServer(function(conn0){
        conn = conn0
        conn.on('data', function(data){
          done(new Error('data got through somehow'))
        })
        
        conn.on('error', function(err){
          done(err)
        })
        
        conn.on('end', function(){
          finalize()
        })
        
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          ch.close()
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
      })
    
    })

    it.skip('reconnects after close')

    it.skip('reconnects after error')
    
  })

  describe('message handling', function(){

    var RPC = require('../lib/protocol').RPC

    var b16 = new Buffer(60000)
    var b32 = new Buffer(100*1024)

    var mm = [['heartbeat', 0, []],
           ['terminate', 0, [0, 'oijojo']],
           ['invoke', 0, ['event1']],
           ['chunk', 0, ['asdfg']],
           ['chunk', 0, [b16]],
           ['chunk', 0, [b32]],
           ['error',0, [0, 'oijasoidjsd']],
           ['choke', 0, []]]

    mm.map(function(m){
      it('handles '+m[0], function(done){
        var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
        var conn

        var method = m[0]
        m[0] = RPC[method]

        function finalize(){
          conn.destroy()
          ch.close()
          S.close()
          done()
        }

        var result = []
        var len = 0

        var S = net.createServer(function(conn0){
          conn = conn0
          conn.write(mp.pack(m))
        })

        S.listen(sockpath, function(){
          ch = new Channel(sockpath)
          ch.on_connect = function(){
            
          }

          ch['on_'+method] = function(){
            finalize()
          }
        })
      })
    })

  })

  describe('socket error handling', function(){

    it('on non-existent dns address', function(done){
      var ch = new Channel('aoidjoasidjf.de', 1234)
      ch.on_socket_error = function(errno0){
        __assert(errno0 === errno.EBADF, 'errno0 === errno.EBADF')
        done()
      }
    })

    it.skip('on unreachable address')

    it('on incorrect unix socket path', function(done){
      var ch = new Channel('/aoidj/oasidjf')
      ch.on_socket_error = function(errno0){
        __assert(errno0 === errno.ENOENT, 'errno0 === errno.ENOENT')
        done()
      }
    })

    it('on incorrect permisstions for unix socket', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'

      var S = net.createServer()

      S.listen(sockpath, function(){
        // jshint -W046
        // it says: Don't use extra leading zeros '0000'
        fs.chmodSync(sockpath, 0000)
        var ch = new Channel(sockpath)
        ch.on_socket_error = function(errno0){
          __assert(errno0 === errno.EACCES, 'errno0 === errno.EACCES')
          S.close()
          done()
        }
      })
    })

    it('on connection refused', function(done){
      var ch = new Channel('localhost', 12344)
      ch.on_socket_error = function(errno0){
        __assert(errno0 === errno.ECONNREFUSED, 'errno0 === errno.ECONNREFUSED')
        done()
      }
    })

    it.skip('on connection timeout')

    it.skip('on socket close')

    it('on socket close after read', function(done){

      var RPC = require('../lib/protocol').RPC

      var b16 = new Buffer(60000)

      var m = ['chunk', 0, [b16]]

      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn

      var method = m[0]
      m[0] = RPC[method]

      function finalize(){
        conn.destroy()
        ch.close()
        S.close()
        done()
      }

      var result = []
      var len = 0

      var S = net.createServer(function(conn0){
        conn = conn0
        conn.end(mp.pack(m))
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          
        }

        ch.on_chunk = function(sid, chunk){
          result.push(chunk)
        }

        ch.on_socket_error = function(errno0){
          __assert(result.length === 1 && result[0].length === 60000)
          __assert(errno0 === errno.ESHUTDOWN)
          finalize()
        }
      })
      
    })


    it('on socket close just on write', function(done){

      var RPC = require('../lib/protocol').RPC

      var b16 = new Buffer(60000)

      var m = ['chunk', 0, [b16]]

      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn

      var ch

      var method = m[0]
      m[0] = RPC[method]

      function finalize(){
        conn.destroy()
        ch.close()
        S.close()
        done()
      }

      var result = []
      var len = 0

      var S = net.createServer({allowHalfOpen: true}, function(conn0){
        conn = conn0
        conn.end()
      })

      S.listen(sockpath, function(){
        var sock = net.connect({allowHalfOpen: true, path: sockpath})
        sock.on('connect', function(){
          conn.destroy()
          
          ch = new Channel(sockpath)
          ch.close()
          ch._injectSocket(sock)
          ch.send(new Buffer(123))
          
          ch.on_socket_error = function(errno0){
            __assert(errno0 === errno.EPIPE || errno0 === errno.ECONNRESET,
                     'errno0 === errno.EPIPE || errno0 === errno.ECONNRESET')
            finalize()
          }
                                    
        })
      })
      
    })
    
    it.skip('on socket shutdown -- the same as <close after read>, in fact')

    it.skip('on socket timeout')
    
  })

  describe('decoding error handling', function(){

    it('on incorrect message framing', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn
      
      function finalize(){
        conn.destroy()
        ch.close()
        S.close()
        done()
      }

      var S = net.createServer(function(conn0){
        conn = conn0
        conn.write(new Buffer([0xa2,1,2]))
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          ch.on_socket_error = function(errno0){
            console.log('socket error after connect', errno0)
            __assert.equal(errno0,errno.EBADMSG, 'errno0 === errno.EBADMSG')
            finalize()
          }
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
      })
    })

    // for now, channel skips messages of semi-good shape
    it.skip('on incorrect heartbeat', function(done){
      var sockpath = '/tmp/cocaine-framework-nodejs.test.'+process.pid+'.sock'
      var conn
      
      function finalize(){
        conn.destroy()
        ch.close()
        S.close()
        done()
      }

      var S = net.createServer(function(conn0){
        conn = conn0
        conn.write(mp.pack([RPC.heartbeat, 0, [0]]))
      })

      S.listen(sockpath, function(){
        ch = new Channel(sockpath)
        ch.on_connect = function(){
          ch.on_socket_error = function(errno0){
            __assert(errno0 === errno.EBADMSG, 'errno0 === errno.EBADMSG')
            finalize()
          }
        }
        ch.on_socket_error = function(errno){
          console.log('channel socket error', arguments)
          done(errno)
        }
        ch.on_heartbeat = function(){
          done(new Error('malformed heartbeat got through'))
        }
      })
    })
    
    it.skip('on incorrect terminate')
    it.skip('on incorrect invoke')
    it.skip('on incorrect chunk')
    it.skip('on incorrect error')
    it.skip('on incorrect choke')
    
  })
  
})



