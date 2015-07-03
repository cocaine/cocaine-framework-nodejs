

var assert = require('assert')
var fmt = require('util').format

function ntime(){
  var sn = process.hrtime()
  return sn[0]*1e9+sn[1]
}



function cp_js_1(storage, chunk, N){

  assert(storage.length % chunk.length === 0)

  while(0<N--){
    var M = storage.length / chunk.length
    for(var ri = 0; ri < M; ri++){
      
      var start = ri*chunk.length
      
      for(var i=0;i<chunk.length;i++){

        storage[start+i] = chunk[i]
        
      }

    }
  }
}

function cp_js_1_branches(storage, chunk, N){

  assert(storage.length % chunk.length === 0)

  var m = 0

  while(0<N--){
    var M = storage.length / chunk.length
    for(var ri = 0; ri < M; ri++){
      
      var start = ri*chunk.length
      
      for(var i=0;i<chunk.length;i++){

        var b = chunk[i]

        if(i%4==0){
          m |= b
        }

        storage[start+i] = b
        
      }

    }
  }

  return m
}


function cp_js_u32(storage, chunk, N){

  assert(storage.length % chunk.length === 0, 'storage.length % chunk.length === 0')
  assert(chunk.length % 4 === 0, 'chunk.length % 4 === 0')

  while(0<N--){
    var M = storage.length / chunk.length
    for(var ri = 0; ri < M; ri++){
      
      var start = ri*chunk.length
      
      for(var i=0;i<chunk.length;i++){

        storage[start+i] = chunk[i]

      }

    }
  }
}


function cp_buf_chunk(storage, chunk, N){

  assert(storage.length % chunk.length === 0)

  while(0<N--){
    var M = storage.length / chunk.length
    for(var ri = 0; ri < M; ri++){
      
      var start = ri*chunk.length

      chunk.copy(storage, start)
      
    }
  }
}




function do_test(cpfn, makeBuf, sliceSym, chunkLength, chunkCount, N0){

  console.log('================================')
  console.log('measuring %s: %skX%s', cpfn.name, chunkLength/1024, chunkCount)

  var chunk = makeBuf(chunkLength, true) //initialize with random data
  
  var storage = makeBuf(chunkLength*chunkCount)
  
  console.log('heat up')

  var N = 4

  var t0 = ntime()
  
  cpfn(storage, chunk, N)

  var s0 = storage[sliceSym](chunk.length*(chunkCount-1))
  assert(s0.length === chunk.length, fmt('s0.length`%s` === chunk.length`%s`', s0.length, chunk.length))
  for(var i=0;i<s0.length;i++){
    if(s0[i]!==chunk[i]){
      throw new Error(fmt('copy failed: s0[i`%s`]`%s`!==chunk[i`%s`]`%s`', i, s0[i], i, chunk[i]))
    }
  }

  var t1 = ntime()

  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  

  console.log('bench')
  
  var N = N0
  
  var t0 = ntime()
  
  var r = cpfn(storage, chunk, N)

  var t1 = ntime()

  console.log('transferred %d Mb in %dus, %dMb/s', storage.length*N/1024/1024, (t1-t0)/1000, storage.length*N/(t1-t0)*(1e9/1024/1024))
  console.log('--------------------------------')

  return r
  
}

function makeBuffer(len, init){
  var b = new Buffer(len)
  if(init){
    for(var i=0;i<b.length;i++){
      b[i]= Math.random()*0x100000000
    }
  }
  return b
}

function makeU32Array(len, init){
  assert(len % 4 === 0)
  var b = new Uint32Array(len/4)
  if(init){
    for(var i=0;i<b.length;i++){
      b[i] = Math.random()*0x100000000
    }
  }
  return b
}

console.log('================================================================')
console.log('cp_js_1')
console.log()

do_test(cp_js_1, makeBuffer, 'slice',  256, 1024, 10*256)
do_test(cp_js_1, makeBuffer, 'slice', 4*1024, 1024, 128)
do_test(cp_js_1, makeBuffer, 'slice', 4*1024, 1024*64, 20)
do_test(cp_js_1, makeBuffer, 'slice', 4*1024*1024, 64, 20)

console.log('================================================================')
console.log('cp_js_1_branches')
console.log()

var r=0

r+=do_test(cp_js_1_branches, makeBuffer, 'slice',  256, 1024, 10*256)
r+=do_test(cp_js_1_branches, makeBuffer, 'slice', 4*1024, 1024, 128)
r+=do_test(cp_js_1_branches, makeBuffer, 'slice', 4*1024, 1024*64, 20)
r+=do_test(cp_js_1_branches, makeBuffer, 'slice', 4*1024*1024, 64, 20)

console.log(r)

console.log('================================================================')
console.log('cp_js_u32')
console.log()

do_test(cp_js_u32, makeU32Array, 'subarray', 256, 1024, 10*256)
do_test(cp_js_u32, makeU32Array, 'subarray', 4*1024, 1024, 128)
do_test(cp_js_u32, makeU32Array, 'subarray', 4*1024, 1024*64, 20)
do_test(cp_js_u32, makeU32Array, 'subarray', 4*1024*1024, 64, 20)

console.log('================================================================')
console.log('cp_buf_chunk')
console.log()

do_test(cp_buf_chunk, makeBuffer, 'slice', 256, 1024, 10*256)
do_test(cp_buf_chunk, makeBuffer, 'slice', 4*1024, 1024, 128)
do_test(cp_buf_chunk, makeBuffer, 'slice', 4*1024, 1024*64, 20)
do_test(cp_buf_chunk, makeBuffer, 'slice', 4*1024*1024, 64, 20)




