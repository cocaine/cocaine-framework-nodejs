
var __assert = require('assert')
var hexy = require('hexy')
var RPC = require('../protocol').RPC
var mp = require('msgpack-bin')

var fail = {v:'fail'}

var trace = 0
var debug = require('debug')('co:mp')

var inspect = require('util').inspect

function unpackMessage(buf, _RPC, invokeBoundary){
  debug('function unpackMessage(buf, _RPC, invokeBoundary){', buf.slice(0,10), '{..}', invokeBoundary)
  if(buf.length === 0){
    return 
  }

  if(!((buf[0] & 0xF0) === 0x90)){
    return fail
  }

  var _RPC = _RPC || RPC

  var parsed = 1
  var sessionId = parseInt(buf, parsed)

  debug('parser got sessionId', sessionId)
  if(sessionId === null){
    // not enough bytes
    return null
  } else if(sessionId === fail){
    return fail
  }
  parsed += parseInt.bytesParsed
  
  var method = parseInt(buf, parsed)

  debug('parser got method', method)
  
  if(method === null){
    // not enough bytes
    return null
  } else if(sessionId === fail){
    return fail
  }
  parsed += parseInt.bytesParsed

  //if(method === _RPC.chunk){
  if(1 < sessionId && sessionId < invokeBoundary && method === 0){
    
    if(!buf[parsed] === 0x91){
      debug('!(buf[parsed] === 0x91) '+buf.slice(parsed).toString())
      return fail
    }
    parsed += 1
    
    var buf1 = parseBuffer(buf, parsed)
    if(buf1 === fail){
      return fail
    } else if(buf1 === null){
      return null
    }
    debug('before parseBuffer, parsed', parsed)
    parsed += parseBuffer.bytesParsed
    
    debug('parseBuffer.bytesParsed', parseBuffer.bytesParsed)
    unpackMessage.bytesParsed = parsed
    
    return [sessionId, method, [buf1]]

  } else {
    var m = mp.unpack(buf)
    debug('mp.unpack.bytes_remaining', mp.unpack.bytes_remaining)
    debug('unpacked', inspect(m, {depth: null}))
    if(m === null){
      return m
    }
    unpackMessage.bytesParsed = buf.length - mp.unpack.bytes_remaining
    return m
  }
}


function getUint8(b,o){
  return b[o]
}

function getUint16(b,o){
  return (b[o]<<8)|b[o+1]
}


function getUint32(b,o){
  return ((b[o]<<24)
    |(b[o+1]<<16)
    |(b[o+2]<<8)
    |(b[o+3]))>>>0
}

var MAX_INT = 0x1fffffffffffff
var MAX_HI = 0x1fffff

function getUint64(b,o){
  var hi = ((b[o]<<24)
         |(b[o+1]<<16)
         |(b[o+2]<<8)
         |(b[o+3]))>>>0
  var lo = ((b[o+4]<<24)
         |(b[o+5]<<16)
         |(b[o+6]<<8)
         |(b[o+7]))>>>0
  __assert(hi <= MAX_HI, 'uint53 overflow')
  return hi*0x100000000+lo
}

function getInt8(b,o){
  var r = getUint8(b,o)
  return r&0x80? 0xffffff00|r : r
}
function getInt16(b,o){
  var r = getUint16(b,o)
  return r&0x80000? 0xffff0000|r : r
}

function getInt32(b,o){
  return getUint32(b,o)|0
}

function getInt64(b,o){
  var hi = ((b[o]<<24)
         |(b[o+1]<<16)
         |(b[o+2]<<8)
         |(b[o+3]))
  var lo = ((b[o+4]<<24)
         |(b[o+5]<<16)
         |(b[o+6]<<8)
         |(b[o+7]))
  if(!(lo|hi))return 0
  if(lo === 0){
    var lo_ = 0xffffffff|0
    var hi_ = ~((hi-1)|0)
  } else {
    var lo_ = ~((lo-1)|0)
    var hi_ = ~hi
  }
  __assert(hi <= MAX_HI, 'int53 overflow')
  return -(hi*0x100000000+lo)

}


function parseInt(b,i){
  var len0 = b.length - i
  if(len0 === 0){
    return null
  }
  var b0 = b[i]
  var r = 0, o =0

  if((0x7f & b0) === b0){
    r = b0
    o = 0
  } else {
    
    switch(b0){
    case 0xcc: //uint8
      if(len0 < 2){
        return null
      }
      r = getUint8(b, i+1)
      o = 1
      break
    case 0xcd: //uint16
      if(len0 < 3){
        return null
      }
      r = getUint16(b, i+1)
      o = 2
      break
    case 0xce: //uint32
      if(len0 < 5){
        return null
      }
      r = getUint32(b, i+1)
      o = 4
      break
    case 0xcf: //uint64
      if(len0 < 9){
        return null
      }
      r = getUint64(b, i+1)
      o = 8
      break

    case 0xd0: //int8
      if(len0 < 2){
        return null
      }
      r = getInt8(b, i+1)
      o = 1
      break
    case 0xd1: //int16
      if(len0 < 3){
        return null
      }
      r = getInt16(b, i+1)
      o = 2
      break
    case 0xd2: //int32
      if(len0 < 5){
        return null
      }
      r = getInt32(b, i+1)
      o = 4
      break
    case 0xd3: //int64
      if(len0 < 9){
        return null
      }
      r = getInt64(b, i+1)
      o = 8
      break
    default:
      debug('parse int failed: '+hexy.hexy(b.slice(i)))
      return fail
    }

  }
  parseInt.bytesParsed = o+1
  return r
}

function parseBuffer(b,i){
  var len0 = b.length - i
  if(len0 === 0){
    return null
  }
  var b0 = b[i]
  switch(true){
  case (b0 & 0xe0) === 0xa0:{
    var len = b0 & (0x20-1)
    if(len0 < len+1){
      return null
    }
    var val = b.slice(i+1,i+1+len)
    parseBuffer.bytesParsed = 1+len
    break
  }
  case b0 === 0xda:{
    var len = (b[i+1]<<8)+b[i+2]
    if(len0 < len+1+2){
      return null
    }
    var val = b.slice(i+3,i+3+len)
    parseBuffer.bytesParsed = 3+len
    break
  }
  case b0 === 0xdb:{
    var len = (b[i+1]<<24) + (b[i+2]<<16) + (b[i+3]<<8) + (b[i+4])
    debug('parseBuffer-raw32 len:', len)
    if(len0 < len+1+4){
      return null
    }
    var val = b.slice(i+5,i+5+len)
    parseBuffer.bytesParsed = 5+len
    break
  }
  default:
    debug('parse binary buffer failed: '+hexy.hexy(b.slice(i)))
    return fail
  }
  return val
}

module.exports.unpackMessage = unpackMessage
module.exports.fail = fail

