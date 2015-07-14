
var __assert = require('assert')
var hexy = require('hexy')
var RPC = require('../protocol').RPC
var mp = require('msgpack-bin')

var fail = {v:'fail'}

var trace = 0
var debug = require('debug')('co:mp')

var _ = require('util')
var inspect = _.inspect
var fmt = _.format


function unpackMessage(buf, _RPC, invokeBoundary){
  debug('function unpackMessage(buf, _RPC, invokeBoundary){', buf.slice(0,10), '{..}', invokeBoundary)
  if(buf.length === 0){
    return null
  }

  if(!((buf[0] & 0xF0) === 0x90)){
    return fail
  }

  var m = mp.unpack(buf, true)

  if(m === null){
    debug('not enough bytes to unpack')
    return null
  }

  debug('message unpacked', m)

  var sessionId = m[0], methodId = m[1], args = m[2]

  if(invokeBoundary <= sessionId){
    // RPC.invoke
    
    __assert(methodId === 0,
             fmt('when invokeBoundary[%s] <= sessionId[%s], methodId[%s] should be 0',
                  invokeBoundary, sessionId, methodId))

    __assert(typeof args === 'object' && args.length === 1,
             "typeof args === 'object' && args.length === 1")
    

    args[0] = args[0].toString('utf8')
    
  }

  unpackMessage.bytesParsed = buf.length - mp.unpack.bytes_remaining
  return m

}


module.exports.unpackMessage = unpackMessage
module.exports.fail = fail

