
require("babel/register")({
  // This will override `node_modules` ignoring - you can alternatively pass
  // an array of strings to be explicitly matched or a regex / glob
  ignore: false
});

var debug = require('debug')('co:test:http')

//var assert = require('chai').assert
var assert = require('assert')

var cocaine = require('cocaine')
var http = cocaine.http

var RPC = {
  invoke: 0,
  chunk: 0,
  error: 1,
  choke: 2
}


var mp = require('msgpack-socket')

var Worker = require('..').Worker
var co = require('co')

var mkTempPath = require('msgpack-socket/pair').mkTempPath

var protocol = require('../lib/protocol')

var q = require('q')

var msgpack = require('msgpack-bin')

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
          debug('writing response')

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

      wc.sendmsg([15, RPC.invoke, ['http'], [1,2,3, 'header']])

      var rq = ['GET','/','HTTP/1.0',
             [['some-header','value'],
              ['content-length', '7']],
             'andbody']

      wc.sendmsg([15, RPC.chunk, [msgpack.pack(rq)], [1,2,3, 'header']])

      wc.sendmsg([15, RPC.choke, [], [1,2,3, 'header']])

      var header

      while(true) {
        var m = yield wc.recvmsg()
        var [sid, method, args] = m

        if(sid !== 15){
          debug(' -- other message from worker', m)
          continue
        }
        debug('node got response from worker', m)


        if(method === RPC.chunk){

          var chunk = args[0]
          
          if(!header){
            header = msgpack.unpack(chunk)
            debug('http response header chunk is', header)
          } else {
            debug('body chunk is', chunk)
          }
        } else {
          if (method === RPC.choke){
            debug('response closed')
            return done()
          } else {
            debug('other message in response channel')
          }
        }
      }

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it('should be able to stream output data', function(done){

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
          debug('writing response')
          
          var i=0
          _write_next()
          function _write_next(){
            res.write('hello, Cocaine! '+i, function(){
              debug('done saying hello', i++)
              if(i<3){
                setTimeout(_write_next, 1000)
              } else {
                res.end()
                0 && res.end(null, function(){
                  debug('done closing response stream')
                })
              }
            })
          }
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

      wc.sendmsg([15, RPC.invoke, ['http'], [1,2,3, 'header']])

      var rq = ['GET','/','HTTP/1.0',
             [['some-header','value'],
              ['content-length', '7']],
             'andbody']

      wc.sendmsg([15, RPC.chunk, [msgpack.pack(rq)], [1,2,3, 'header']])

      wc.sendmsg([15, RPC.choke, [], [1,2,3, 'header']])

      var header

      while(true) {
        var m = yield wc.recvmsg()
        var [sid, method, args] = m

        if(sid !== 15){
          debug(' -- other message from worker', m)
          continue
        }
        debug('node got response from worker', m)


        if(method === RPC.chunk){

          var chunk = args[0]
          
          if(!header){
            header = msgpack.unpack(chunk)
            debug('http response header chunk is', header)
          } else {
            debug('body chunk is', chunk)
          }
        } else {
          if (method === RPC.choke){
            debug('response closed')
            return done()
          } else {
            debug('other message in response channel')
          }
        }
      }

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
    
  })


  it('should be able to stream output data in really large chunks', function(done){

    co(function *test(){

      var sentLength = 0
      var recvLength = 0

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
          debug('writing response')

          var b = new Buffer(10000000)
          b.fill('a')
          
          var i=0
          _write_next()
          function _write_next(){
            res.write(b, function(){
              sentLength += b.length
              debug('done saying hello', i++)
              if(i<8){
                setTimeout(_write_next, 1000)
              } else {
                res.end()
              }
            })
          }
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

      wc.sendmsg([15, RPC.invoke, ['http'], [1,2,3, 'header']])

      var rq = ['GET','/','HTTP/1.0',
             [['some-header','value'],
              ['content-length', '7']],
             'andbody']

      wc.sendmsg([15, RPC.chunk, [msgpack.pack(rq)], [1,2,3, 'header']])

      wc.sendmsg([15, RPC.choke, [], [1,2,3, 'header']])

      var header

      while(true) {
        var m = yield wc.recvmsg()
        var [sid, method, args] = m

        if(sid !== 15){
          debug(' -- other message from worker', m)
          continue
        }
        debug('node got response from worker', m)


        if(method === RPC.chunk){

          var chunk = args[0]
          
          if(!header){
            header = msgpack.unpack(chunk)
            debug('http response header chunk is', header)
          } else {
            debug('body chunk is', chunk)
            recvLength += chunk.length
          }
        } else {
          if (method === RPC.choke){
            debug('response closed')

            assert.deepEqual(sentLength, recvLength)
            
            return done()
          } else {
            debug('other message in response channel')
          }
        }
      }

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


})




