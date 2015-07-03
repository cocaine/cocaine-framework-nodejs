
var assert = require('assert')

var mp = require('@nojs/msgpack-socket')

var Worker = require('cocaine').Worker
var co = require('co')

var mkTempPath = require('@nojs/msgpack-socket/pair').mkTempPath

var protocol = require('../lib/protocol')

var q = require('q')

var msgpack = require('msgpack')

var RPC = {
  invoke: 0,
  chunk: 0,
  error: 1,
  choke: 2
}

var debug = require('debug')('co:test:worker')

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

describe('worker', function(){

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

  it('should handshake with uuid', function(done){

    co(function *test(){

      W.connect()

      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [sid, method, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      done()

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })

  })


  it('should receive simple event', function(done){

    co(function *test(){

      W.connect()

      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [sid, method, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      var h = W.await('handle1')

      wc.sendmsg([15, RPC.invoke, ['handle1']])

      var s = yield h

      debug('worker received event')

      wc.sendmsg([15, RPC.chunk, ['body']])

      var d = yield s.await('data')

      console.log('worker got data `%s`', d)

      wc.sendmsg([15, RPC.choke, []])

      yield s.await('end')

      done()


    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it('should respond to simple event', function(done){

    co(function *test(){

      W.connect()

      var wc = yield Node.await('connection')

      console.log('worker connected')

      var m = yield wc.recvmsg(msgpack.unpack)

      console.log('node got message', m)

      var [sid, method, [uuid]] = m

      assert(uuid === options.uuid, "worker handshakes with it's uuid")

      wc.sendmsg([15, RPC.invoke, ['handle1']])

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


  it('should receive input stream', function(done){

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


  it('should stream both ways', function(done){

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


  it('should stream really huge chunks both ways', function(done){

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




