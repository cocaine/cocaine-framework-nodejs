
require("babel/register")({
  // This will override `node_modules` ignoring - you can alternatively pass
  // an array of strings to be explicitly matched or a regex / glob
  ignore: false
});

var debug = require('debug')('test:locator')

var assert = require('assert')

var fmt = require('util').format

var mp = require('msgpack-socket')

var Locator = require('cocaine').Locator
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

describe('locator client', function(){

  var mockLocator, S

  var locatorEndpoint, serviceEndpoint

  beforeEach(function(done){

    co(function *setup(){

      locatorEndpoint = ['::1', Math.floor(Math.random()*32000+32000)]

      mockLocator = new mp.Server()
      mockLocator.listen(locatorEndpoint[1], locatorEndpoint[0])

      yield mockLocator.await('listening')

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
  })

  it('should ask locator about service and get answer right', function(done){

    co(function *test(){

      var L = new Locator([locatorEndpoint])
      
      L.connect()

      var [_, lc] = yield [L.await('connect'), mockLocator.await('connection')]

      debug('locator connected')

      var result = Q.defer()
      L.resolve('svcname', function(err, endpoints, version, graph){
        result.resolve([err, endpoints, version, graph])
      })

      var m = yield lc.recvmsg(msgpack.unpack)
      debug('locator got message', m)
      
      var [sid, method, [name]] = m
      assert.deepEqual(m, [sid, 0, ['svcname']])
      assert(typeof sid === 'number' && 0<sid, fmt("typeof sid === 'number' && 0<sid[%s]", sid))

      var resp =  [sid, 0,
                [
                  [["2a02:6b8:0:1a16:556::201", 59136], ["1.2.3.4", 59136]],
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

      var result1 = yield result.promise
      debug('result1', inspect(result1))

      var [err1, endpoints1, version1, graph1] = result1

      assert.deepEqual([err1, endpoints1, version1, graph1], [null, endpoints, version, graph])

      return done()
      
    }).catch(function(err){
      process.nextTick(function(){
        throw err
      })
    })

  })

})




