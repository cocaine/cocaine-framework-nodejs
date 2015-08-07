var debug = require('debug')('co:test:http')

var assert = require('assert')

var _normalizeEndpoints = require('cocaine/lib/client/locator')._normalizeEndpoints

describe('locator normalizes endpoints', function(){

  describe('various cases it should be able to accept and normalize', function(){

    it('should accept single ip4 endpoint', function(){
      var endpoint = ['1.2.3.4', 12345]
      var expected = [['1.2.3.4', 12345]]

      var result = _normalizeEndpoints(endpoint)

      assert.deepEqual(expected, result)
    })

    it('should accept single ip6 endpoint', function(){
      var endpoint = ['2a02:6b8:0:1a30::51',10053]
      var expected = [['2a02:6b8:0:1a30::51',10053]]

      var result = _normalizeEndpoints(endpoint)

      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip4 endpoints', function(){
      var endpoints = [['1.2.3.4', 12345], ['1.2.3.4', 12345]]
      var expected = [['1.2.3.4', 12345], ['1.2.3.4', 12345]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip6 endpoints as strings', function(){
      var endpoints = [['2a02:6b8:0:1a30::51',10053], ['2a02:6b8:0:1a30::51', 10053]]
      var expected = [['2a02:6b8:0:1a30::51',10053], ['2a02:6b8:0:1a30::51',10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ipv4/ip6 endpoints as strings', function(){
      var endpoints = ['[2a02:6b8:0:1a30::51]:10053', '37.9.68.9:10053']
      var expected = [['2a02:6b8:0:1a30::51',10053], ['37.9.68.9', 10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip4 endpoints as strings', function(){
      var endpoints = ['1.2.3.4:12345', '1.2.3.4:12345']
      var expected = [['1.2.3.4', 12345], ['1.2.3.4', 12345]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip6 endpoints as strings', function(){
      var endpoints = ['[2a02:6b8:0:1a30::51]:10053', '[2a02:6b8:0:1a30::51]:10053']
      var expected = [['2a02:6b8:0:1a30::51',10053], ['2a02:6b8:0:1a30::51',10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ipv4/ip6 endpoints as strings', function(){
      var endpoints = ['[2a02:6b8:0:1a30::51]:10053', '37.9.68.9:10053']
      var expected = [['2a02:6b8:0:1a30::51',10053], ['37.9.68.9', 10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept single ipv6 endpoint as a string', function(){

      var endpoint = '[2a02:6b8:0:1a30::51]:10053'
      var expected = [['2a02:6b8:0:1a30::51', 10053]]
      
      var result = _normalizeEndpoints(endpoint)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip6/ip4 endpoints as a string', function(){

      var endpoints = '[2a02:6b8:0:1a30::51]:10053,37.9.68.9:10053'
      var expected = [['2a02:6b8:0:1a30::51',10053], ['37.9.68.9',10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })

    it('should accept multiple ip6/ip4 endpoints as a string and tolerate whitespaces in between', function(){

      var endpoints = '[2a02:6b8:0:1a30::51]:10053 , 37.9.68.9:10053'
      var expected = [['2a02:6b8:0:1a30::51',10053], ['37.9.68.9',10053]]

      var result = _normalizeEndpoints(endpoints)
      assert.deepEqual(expected, result)
    })
    
  })

  describe('bad erroneous cases that are considered bad input', function(){

    it('should throw on undefined endpoint', function(){
      
      assert.throws(function(){
        _normalizeEndpoints(undefined)
      })
      
    })
  })

})

