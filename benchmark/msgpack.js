
var mp = require('msgpack')

var assert = require('assert')
var fmt = require('util').format

function ntime(){
  var sn = process.hrtime()
  return sn[0]*1e9+sn[1]
}




function read_js_1_branches(storage, chunk, N){

  assert(storage.length % chunk.length === 0, fmt('storage.length`%s` % chunk.length`%s` === 0', storage.length, chunk.length))

  var rr = [0,1,2,3,4,5,6,7]

  var m = 0

  while(0<N--){
    var M = storage.length / chunk.length
    for(var ri = 0; ri < M; ri++){
      
      var start = ri*chunk.length
      
      for(var i=0;i<chunk.length;i++){

        var b = chunk[i]

        if(i%4==0){
          m ^= b
        }

        storage[start+i] = b
        
      }


      var r = [['GET'+m, '/poijasdf/poijasdf/poijpoijasdf'+m,
             [['poijpoijsdf'+m, 'poijpoijasdf'+m],
              ['poijpoijsdf1'+m, 'poijpoijasdf1'+m],
              ['poijpoijsdf2'+m, 'poijpoijasdf2'+m],
              ['poijpoijsdf3'+m, 'poijpoijasdf3'+m],
              ['poijpoijsdf4'+m, 'poijpoijasdf4'+m],
              ['poijpoijsdf5'+m, 'poijpoijasdf5'+m]],
             'poijaposdijfpoiasdjfpoiasjdpfoiaspdfijpaosidfjpoa'+m]]
      
      rr[(i+m)%8] = r
    }
  }

  return rr
}

function read_msgpack(storage, chunkLength, N){
  assert(storage.length % chunkLength === 0)

  var rr = [0,1,2,3,4,5,6,7]

  var i = 0

  while(0<N--){
    var start = 0
    var remaining = storage.length

    while(0<remaining){

      var m = mp.unpack(storage.slice(start))
      remaining = mp.unpack.bytes_remaining

      rr[i++%8] = m

      start += chunkLength
      
    }
  }

  return rr
  
}

function makeBuf(len, init){
  var b = new Buffer(len)
  if(init){
    for(var i=0;i<b.length;i++){
      b[i]= Math.random()*0x100000000
    }
  }
  return b
}


function do_test(chunk, chunkCount, N0){

  console.log('================================')
  console.log('measuring js_copy_1_branches: %sX%s', chunk.length, chunkCount)

  var storage = makeBuf(chunk.length*chunkCount)

  console.log('input: storage`%s`, chunk`%s`', storage.length, chunk.length)
  
  console.log('heat up')

  var N = 4

  var t0 = ntime()
  
  var r = read_js_1_branches(storage, chunk, N)
  console.log(r)

  var s0 = storage.slice(chunk.length*(chunkCount-1))
  assert(s0.length === chunk.length, fmt('s0.length`%s` === chunk.length`%s`', s0.length, chunk.length))
  for(var i=0;i<s0.length;i++){
    if(s0[i]!==chunk[i]){
      throw new Error(fmt('copy failed: s0[i`%s`]`%s`!==chunk[i`%s`]`%s`', i, s0[i], i, chunk[i]))
    }
  }

  var t1 = ntime()

  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  console.log('or %s krps/s', storage.length/chunk.length*N/((t1-t0)/1e9)/1000)


  console.log('bench')
  
  var N = N0
  
  var t0 = ntime()
  
  var r = read_js_1_branches(storage, chunk, N)
  console.log(r)

  var t1 = ntime()

  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  console.log('or %s krps/s', storage.length/chunk.length*N/((t1-t0)/1e9)/1000)


  console.log('--------------------------------')

  console.log('================================================================')
  console.log('measuring msgpack: %sX%s', chunk.length, chunkCount)

  console.log('heat up')

  var N = 4

  var t0 = ntime()
  
  var r = read_msgpack(storage, chunk.length, N)

  var t1 = ntime()
  
  console.log(r)

  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  console.log('or %s krps/s', storage.length/chunk.length*N/((t1-t0)/1e9)/1000)

  console.log('bench')

  var N = N0

  var t0 = ntime()
  
  var r = read_msgpack(storage, chunk.length, N)

  var t1 = ntime()

  console.log(r)
  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  console.log('or %s krps/s', storage.length/chunk.length*N/((t1-t0)/1e9)/1000)

  
}


var m = ['GET', '/poijasdf/poijasdf/poijpoijasdf',
      [['poijpoijsdf', 'poijpoijasdf'],
       ['poijpoijsdf1', 'poijpoijasdf1'],
       ['poijpoijsdf2', 'poijpoijasdf2'],
       ['poijpoijsdf3', 'poijpoijasdf3'],
       ['poijpoijsdf4', 'poijpoijasdf4'],
       ['poijpoijsdf5', 'poijpoijasdf5']],
      'poijaposdijfpoiasdjfpoiasjdpfoiaspdfijpaosidfjpoa']

var b0 = mp.pack(m)


assert(b0.length === 256, 'b0.length === 256')


do_test(b0, 1024*16, 4*128)

