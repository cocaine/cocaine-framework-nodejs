

var jp = require('jampack')

var P = jp([
  jp.bool, //success
  jp.binary, //data
  jp.int, //code
  jp.map( //headers
    jp.string,
    jp.string)
])

function unpackUrlFetchChunk(buf){
  return P.parse(jp.Stream(buf))
}


module.exports = function(methods){
  return {
    defaultMethod: methods.unpacking,
    methods:{
      get: methods.unpackWith(unpackUrlFetchChunk),
      post: methods.unpackWith(unpackUrlFetchChunk)
    }
  }  
}



