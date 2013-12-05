

var jp = require('jampack')

var P = jp.binary()

function unpackBinaryChunk(buf){
  return P.parse(jp.Stream(buf))
}


module.exports = function(methods){
  return {
    defaultMethod: methods.unpacking,
    methods:{
      read: methods.unpackWith(unpackBinaryChunk),
      cache_read: methods.unpackWith(unpackBinaryChunk)
    }
  }  
}



