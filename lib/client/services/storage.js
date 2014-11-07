

var jp = require('jampack')

var P = jp.binary()

function unpackBinaryChunk(buf){
  return P.parse(jp.Stream(buf))
}


module.exports = {
  methods:{
    read: unpackBinaryChunk,
    read_latest: unpackBinaryChunk,
    cache_read: unpackBinaryChunk
  }
}


