
var debug = require('debug')('co:test:http')
var assert = require('chai').assert

var cocaine = require('cocaine')
var http = cocaine.http

var RPC = {
  invoke: 0,
  chunk: 0,
  error: 1,
  choke: 2
}


var mp = require('@nojs/msgpack-socket')

var Worker = require('..').Worker
var co = require('co')

var mkTempPath = require('@nojs/msgpack-socket/pair').mkTempPath

var protocol = require('../lib/protocol')

var q = require('q')

var msgpack = require('msgpack')

function sleep(ms){

  var result = q.defer()

  var uid = (Math.random()*0x100000000).toString(36)
  
  console.log(uid, 'sleeping for', ms)
  setTimeout(function(){
    console.log(uid, 'awake')
    result.resolve()
  }, ms)

  return result.promise
}

describe('http worker', function(){

  var Locator, Node

  var locatorEndpoint, nodeEndpoint
  var W, options

  beforeEach(function(done){

    co(function *setup(){

      [locatorEndpoint, nodeEndpoint] = [mkTempPath(), mkTempPath()] 

      Locator = new mp.Server()
      Node = new mp.Server()

      Locator.listen(locatorEndpoint)
      Node.listen(nodeEndpoint)

      yield [Locator.await('listening'), Node.await('listening')]

      console.log('listening')

      options = {locator: locatorEndpoint,
                 endpoint: nodeEndpoint,
                 app: 'testapp',
                 uuid: 'f5fe7be9-3dbf-4636-840f-f255cbb2f702'}

      W = new Worker(options)

      done()

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
  })

  afterEach(function(){
    Node.close()
    Locator.close()
    W.close()
  })

  it('should respond to simple event', function(done){

    co(function *test(){

      debug('creating http server')

      var server = new http.Server(function(req, res){
        
        debug('http server got request')
        
        var body = []

        req.on('data', function(data){
          debug('http server got data on request', data)
          body.push(data)
        })
        
        req.on('end', function(){
          debug('end input stream, so writing response')
          res.writeHead(200, {
            'x-any-header': 'x-any-value',
            'content-type': 'text/plain'
          })
          res.end('hello, Cocaine!')
        })
        
      })

      var handle = W.getListenHandle('http')

      server.listen(handle)

      var [_, wc] = yield [server.await('listening'), Node.await('connection')]

      debug('http server listening, worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      debug('node got message', m)

      var [sid, method, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      wc.sendmsg([15, RPC.invoke, ['http']])

      var rq = ['GET','/','HTTP/1.0',
             [['some-header','value'],
              ['content-length', '7']],
             'andbody']

      wc.sendmsg([15, RPC.chunk, [msgpack.pack(rq)]])

      wc.sendmsg([15, RPC.choke, []])

      var m = yield wc.recvmsg()

      debug('node got message from worker', m)
      
      yield sleep(3*1000)

      var m = yield wc.recvmsg()
      debug('node got message from worker', m)
      
      var [method, sid, [chunk]] = m

      debug('http response header is', msgpack.unpack(chunk))
      

      var m = yield wc.recvmsg()
      debug('node got message from worker', m)
      
      var [method, sid, [chunk]] = m

      debug('actual http response is `%s`', chunk)
      
      yield sleep(3*1000)

      var m = yield wc.recvmsg()
      debug('node got message from worker', m)

      return done()

      var s = yield W.await('handle1')

      wc.sendmsg([15, RPC.chunk, ['body']])

      var d = yield s.await('data')

      console.log('worker got data `%s`', d)

      var m = yield wc.recvmsg()

      console.log('response from worker, heartbeat', m)


      var r = s.write(Buffer('r1'))
      console.log('buffer consumed', r)
      var r = s.write(Buffer('r2'))
      console.log('buffer consumed', r)

      var m = yield wc.recvmsg()
      console.log('response from worker', m)

      var m = yield wc.recvmsg()
      console.log('response from worker', m)

      var r = s.end(Buffer('r3'))
      console.log('buffer consumed', r)

      var m = yield wc.recvmsg()
      console.log('response from worker', m)


      wc.sendmsg([15, RPC.choke, []])

      yield s.await('end')
      console.log('end stream from worker')

      done()

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it.skip('should receive input stream', function(done){

    co(function *test(){

      W.connect()
      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [method, sid, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      wc.sendmsg([15, RPC.invoke, ['handle1']])

      var s = yield W.await('handle1')

      yield [
        (function *sub1(){

          for(var i=0;i<10;i++){
            wc.sendmsg([15, RPC.chunk, ['body'+i]])
            yield sleep(200)
          }
        })(),

        (function *sub2(){
          var i=0
          while(i<10){
            yield s.await('readable')

            var d
            while(d = s.read()){
              i++
              console.log('worker got data `%s`', d)
            }
          }
        })()]

      var m = yield wc.recvmsg()

      console.log('response from worker, heartbeat', m)

      s.end()

      wc.sendmsg([15, RPC.choke, []])

      yield s.await('end')
      console.log('worker: end of input stream')

      var m = yield wc.recvmsg()
      console.log('client: end of worker output stream', m)

      assert.deepEqual(m, [15, RPC.choke, []])


      done()


    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it.skip('should stream both ways', function(done){

    co(function *test(){

      W.connect()
      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [method, sid, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      wc.sendmsg([15, RPC.invoke, ['handle1']])

      var s = yield W.await('handle1')

      yield [
        (function *sub1(){

          for(var i=0;i<10;i++){
            wc.sendmsg([15, RPC.chunk, ['body'+i]])
            yield sleep(200)
            
            while(true){
              var m = yield wc.recvmsg()
              if(m[0] === 15){
                // accept only messages from this channel id
                break
              }
            }

            console.log('server got message back', m)
            
          }
        })(),

        (function *sub2(){
          var i=0
          while(i<10){
            yield s.await('readable')

            var d
            while(d = s.read()){
              i++
              console.log('worker got data `%s`', d)
              s.write(d)
              console.log('writing data back')
            }
          }
        })()]

      // var m = yield wc.recvmsg()

      // console.log('response from worker, heartbeat', m)

      s.end()

      wc.sendmsg([15, RPC.choke, []])

      yield s.await('end')
      console.log('worker: end of input stream')

      var m = yield wc.recvmsg()
      console.log('client: end of worker output stream', m)

      assert.deepEqual(m, [15, RPC.choke, []])


      done()


    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it.skip('should stream really huge chunks both ways', function(done){

    co(function *test(){

      W.connect()
      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [method, sid, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      wc.sendmsg([15, RPC.invoke, ['handle1']])

      var s = yield W.await('handle1')

      var b = Buffer(1024*1024*16)
      
      yield [
        (function *sub1(){

          for(var i=0;i<10;i++){
            wc.sendmsg([15, RPC.chunk, [b]])
            yield sleep(200)
            
            while(true){
              var m = yield wc.recvmsg()
              if(m[0] === 15){
                // accept only messages from this channel id
                break
              }
            }

            var [sid, method, [buf]] = m

            console.log('node got message back', [sid, method, [buf.slice(0,10)]], buf.length)

            assert(buf.length === b.length, 'chunk should be of the same length as sent')
            
          }
        })(),

        (function *sub2(){
          var i=0
          while(i<10){
            yield s.await('readable')

            var d
            while(d = s.read()){
              i++
              console.log('worker got data `%s`, length %d', d.slice(0, 30), d.length)
              s.write(d)
              console.log('writing data back')
            }
          }
        })()]

      // var m = yield wc.recvmsg()

      // console.log('response from worker, heartbeat', m)

      s.end()

      wc.sendmsg([15, RPC.choke, []])

      yield s.await('end')
      console.log('worker: end of input stream')

      var m = yield wc.recvmsg()
      console.log('client: end of worker output stream', m)

      assert.deepEqual(m, [15, RPC.choke, []])


      done()


    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })

})




