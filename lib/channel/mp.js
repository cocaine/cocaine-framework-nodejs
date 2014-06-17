
var __assert = require('assert')
var hexy = require('hexy')
var RPC = require('../protocol').RPC
var mp = require('msgpack')

var fail = {v:'fail'}

var trace = 0

function unpackMessage(buf){
  if(buf.length === 0){
    return 
  }

  if(!(buf[0] === 0x93)){
    return fail
  }

  var parsed = 1
  var method = parseInt(buf, parsed)

  trace && console.log('parser got method', method)
  
  if(method === null){
    return null
  }
  parsed += parseInt.bytesParsed

  if(method === RPC.chunk){
    var sid = parseInt(buf, parsed)
    if(sid === fail){
      return fail
    }
    
    parsed += parseInt.bytesParsed
    trace && console.log('parsed sid,len', sid, parseInt.bytesParsed)
    
    if(!buf[parsed] === 0x91){
      trace && console.log('buf[parsed] === 0x91 '+buf.slice(parsed).toString())
      return fail
    }
    parsed += 1
    
    var buf1 = parseBuffer(buf, parsed)
    if(buf1 === fail){
      return fail
    } else if(buf1 === null){
      return null
    }
    trace && console.log('before parseBuffer, parsed', parsed)
    parsed += parseBuffer.bytesParsed
    
    trace && console.log('parseBuffer.bytesParsed', parseBuffer.bytesParsed)
    unpackMessage.bytesParsed = parsed
    
    return [method, sid, [buf1]]

  } else {
    var m = mp.unpack(buf)
    trace && console.log('mp.unpack.bytes_remaining', mp.unpack.bytes_remaining)
    trace && console.log('unpacked', m)
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
      trace && console.log('parse int failed: '+hexy.hexy(b.slice(i)))
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
    if(len0 < len+1+1){
      return null
    }
    trace && console.log('parsed buffer len', len)
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
    if(len0 < len+1+4){
      return null
    }
    var val = b.slice(i+5,i+5+len)
    parseBuffer.bytesParsed = 5+len
    break
  }
  default:
    trace && console.log('parse binary buffer failed: '+hexy.hexy(b.slice(o)))
    return fail
  }
  return val
}

module.exports.unpackMessage = unpackMessage
