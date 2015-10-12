
require("babel/register")({
  // This will override `node_modules` ignoring - you can alternatively pass
  // an array of strings to be explicitly matched or a regex / glob
  ignore: false
});

var debug = require('debug')('test:binary_service')

var assert = require('assert')
//var assert = require('chai').assert

var fmt = require('util').format

var mp = require('msgpack-socket')

var cocaine = require('cocaine')
var Locator = cocaine.Locator
var Service = cocaine.Service

var co = require('co')

var pair = require('msgpack-socket/pair')
var mkTempPath = pair.mkTempPath
var mkSocketPair = pair.mkSocketPair

var protocol = require('../lib/protocol')

var inspect1 = require('util').inspect

function inspect(obj){
  return inspect1(obj, {depth: null})
}

var Q = require('q')

var msgpack = require('msgpack-bin')

function sleep(ms){

  var result = Q.defer()

  var uid = (Math.random()*0x100000000).toString(36)
  
  debug(uid, 'sleeping for', ms)
  setTimeout(function(){
    debug(uid, 'awake')
    result.resolve()
  }, ms)

  return result.promise
}

describe('service client', function(){

  var mockLocator, mockService

  var locatorEndpoint, serviceEndpoint

  beforeEach(function(done){

    co(function *setup(){

      //locatorEndpoint = ['::1', Math.floor(Math.random()*32000+32000)]
      locatorEndpoint = ['::1', 10053]
      serviceEndpoint = ['::1', Math.floor(Math.random()*32000+32000)]

      mockLocator = new mp.Server()
      mockLocator.listen(locatorEndpoint[1], locatorEndpoint[0])

      mockService = new mp.Server()
      mockService.listen(serviceEndpoint[1], serviceEndpoint[0])

      yield [mockLocator.await('listening'), mockService.await('listening')]

      debug('listening')

      done()

    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })
  })

  afterEach(function(){
    mockLocator.close()
    mockService.close()
  })

  it('should resolve, connect, call method, handle response', function(done){

    co(function *test(){

      var S = new Service('svcname')
      
      S.connect()
      
      var lc = yield mockLocator.await('connection')

      debug('connected to locator')

      var m = yield lc.recvmsg(msgpack.unpack)
      debug('locator got message', m)

      var [sid, method, [name]] = m
      assert.deepEqual(m, [sid, 0, ['svcname']])
      assert(typeof sid === 'number' && 0<sid, fmt("typeof sid === 'number' && 0<sid[%s]", sid))

      var resp =  [sid, 0,
                [
                  [serviceEndpoint],
                  1,
                  {
                    "0": ["subscribe",
                          {"0": ["close", {}]},
                          {"0": ["write", null],
                           "1": ["error", {}],
                           "2": ["close", {}]}],

                    "1": ["children_subscribe",
                          {"0": ["close", {}]},
                          
                          {"0": ["write", null],
                           "1": ["error", {}],
                           "2": ["close", {}]}],
                    
                    "2": ["put",
                          {"0": ["close", {}]},
                          
                          {"0": ["value", {}],
                           "1": ["error", {}]}]}]]

      var [_sid, method, [endpoints, version, graph]] = resp

      lc.sendmsg(resp)

      var [sc, _] = yield [mockService.await('connection'), S.await('connect')]

      debug('connected to service')

      var args = ['qqq', 12, 15, 'fff']
      var rx = S.subscribe.apply(S, args)

      var m = yield sc.recvmsg(msgpack.unpack)

      debug('service got message', m)
      var [sid, method, [...args]] = m
      assert.deepEqual([sid, method, args], [sid, 0, ['qqq', 12, 15, 'fff']])

      sc.sendmsg([sid, 0, ['aaa.bbb.ccc', 112233]])

      rx.recv({
        write: function(path, value){
          debug('write(path`%s`, value`%s`) method from service', path, value)
          assert.deepEqual([path, value], ['aaa.bbb.ccc', 112233])
          done()
        }
      })
      
    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })

  })

  it('should receive stream of messages', function(done){

    co(function *test(){

      var S = new Service('svcname')
      
      S.connect()
      
      var lc = yield mockLocator.await('connection')

      debug('connected to locator')

      var m = yield lc.recvmsg(msgpack.unpack)
      debug('locator got message', m)

      var [sid, method, [name]] = m
      assert.deepEqual(m, [sid, 0, ['svcname']])
      assert(typeof sid === 'number' && 0<sid, fmt("typeof sid === 'number' && 0<sid[%s]", sid))

      var resp =  [sid, 0,
                [
                  [serviceEndpoint],
                  1,
                  {
                    "0": ["subscribe",
                          {"0": ["close", {}]},
                          {"0": ["write", null],
                           "1": ["error", {}],
                           "2": ["close", {}]}],

                    "1": ["children_subscribe",
                          {"0": ["close", {}]},
                          
                          {"0": ["write", null],
                           "1": ["error", {}],
                           "2": ["close", {}]}],
                    
                    "2": ["put",
                          {"0": ["close", {}]},
                          
                          {"0": ["value", {}],
                           "1": ["error", {}]}]}]]

      var [_sid, method, [endpoints, version, graph]] = resp

      lc.sendmsg(resp)

      var [sc, _] = yield [mockService.await('connection'), S.await('connect')]

      debug('connected to service')

      var args = ['qqq', 12, 15, 'fff']
      var rx = S.subscribe.apply(S, args)

      var m = yield sc.recvmsg(msgpack.unpack)

      debug('service got message', m)
      var [sid, method, [...args]] = m
      assert.deepEqual([sid, method, args], [sid, 0, ['qqq', 12, 15, 'fff']])

      var count = 0, N = 10
      rx.recv({
        write: function(path, value){
          debug('write(path`%s`, value`%s`) method from service', path, value)
          assert.deepEqual([path, value], ['aaa.bbb.ccc', 112233])
          count++
          if(count === N){
            done()
          }
        }
      })
      

      for(var i=0;i<N;i++){

        var m = [sid, 0, ['aaa.bbb.ccc', 112233]]
        debug('service sending', m)
        sc.sendmsg(m)

        yield sleep(100)

      }
      
    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })

  })

})




