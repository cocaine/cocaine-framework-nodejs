
// var jp = require('@nojs/jampack')

// var P = jp([
//   jp.bool, //success
//   jp.binary, //data
//   jp.int, //code
//   jp.map( //headers
//     jp.string,
//     jp.string)
// ])

// function unpackUrlFetchChunk(buf){
//   return P.parse(jp.Stream(buf))
// }

function decoder(result){
  var ok = result[0]
  var data = result[1]
  var code = result[2]
  var headers0 = result[3]

  var headers1 = {}
  for(var k in headers0){
    headers1[k] = headers0[k].toString('ascii')
  }

  return [ok, data, code, headers1]
}


module.exports = function(methods){
  return {
    defaultMethod: methods.oneoff,
    methods:{
      
      get: methods.oneoffWithDecoder(decoder),
      //get: methods.oneoff,
      //get: methods.unpackWith(unpackUrlFetchChunk),
      // (url string,
      //  timeout int,
      //  cookies {},
      //  headers {},
      //  follow_location bool)
      
      post: methods.oneoffWithDecoder(decoder)
      //post: methods.oneoff
      //post: methods.unpackWith(unpackUrlFetchChunk)
      // (url string,
      //  body Buffer|string
      //  timeout int,
      //  cookies {},
      //  headers {},
      //  follow_location bool)
      
    }
  }  
}

