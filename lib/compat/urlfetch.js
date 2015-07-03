
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
      // (url string,
      //  timeout int,
      //  cookies {},
      //  headers {},
      //  follow_location bool)

      post: methods.unpackWith(unpackUrlFetchChunk)
      // (url string,
      //  body Buffer|string
      //  timeout int,
      //  cookies {},
      //  headers {},
      //  follow_location bool)
      
    }
  }  
}

