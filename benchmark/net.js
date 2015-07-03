
var co = require('co')
var Q = require('q')

var assert = require('assert')
var fmt = require('util').format

var fs = require('fs')

function ntime(){
  var sn = process.hrtime()
  return sn[0]*1e9+sn[1]
}


var mkSocketPair = require('@nojs/msgpack-socket/pair').mkSocketPair

function *copy_over_unix_socket(){

  var result = Q.defer()

  var cs = yield mkSocketPair()

  console.log('pair ready')

  var b = new Buffer(1024*1024)

  var receivedBytes = 0

  
  cs[1].on('data', function(data){
    console.log('received', data.length)
    receivedBytes += data.length
  })

  cs[1].on('end', function(){
    var t1 = ntime()

    console.log('transferred %s Mb in %s, %sMb/s', receivedBytes/1024/1024, (t1-t0)/1e9, receivedBytes/(t1-t0)*(1e9/1024/1024))

    result.resolve(['transferred %s Mb in %s, %sMb/s', receivedBytes/1024/1024, (t1-t0)/1e9, receivedBytes/(t1-t0)*(1e9/1024/1024)])
    
  })

  cs[1]._readableState.highWaterMark = 1024*1024

  var t0 = ntime()

  var N = 800

  cs[0].write(b)

  cs[0].on('drain', function(){
    var r = false
    if(0<N){
      do {
        N--
        console.log('writing', b.length)
      } while(cs[0].write(b))
      console.log('stream stuck')
    } else {
      cs[0].end(b)
    }
  })

  return result.promise
}

function *copy_over_tcp_socket(){

  var result = Q.defer()

  var cs = yield mkSocketPair()

  var f = fs.createWriteStream('/dev/null')

  f._writableState.highWaterMark = 10*1024*1024
  //cs[1]._readableState.highWaterMatk = 10*1024*1024

  console.log('pair ready')

  var b = new Buffer(1024*1024)

  var receivedBytes = 0

  //cs[1].pipe(f)

  cs[1].on('readable', function(){
    var b = cs[1].read(1024*1024)
    if(b){
      receivedBytes += b.length
      f.write(b)
    }
  })
  
  // cs[1].on('data', function(data){
  //   console.log('received', data.length)
  //   receivedBytes += data.length
  // })

  cs[1].on('end', function(){
    var t1 = ntime()

    receivedBytes = 1602*1024*1024

    console.log('transferred %s Mb in %s, %sMb/s', receivedBytes/1024/1024, (t1-t0)/1e9, receivedBytes/(t1-t0)*(1e9/1024/1024))

    result.resolve(['transferred %s Mb in %s, %sMb/s', receivedBytes/1024/1024, (t1-t0)/1e9, receivedBytes/(t1-t0)*(1e9/1024/1024)])
    
  })

  var t0 = ntime()

  var N = 1600

  cs[0].write(b)

  cs[0].on('end', function(){
    console.log('client ended somehow')
  })


  cs[0].on('drain', function(){
    var r = false
    if(0<N){
      N--
      do {
        console.log('writing', b.length)
      } while(cs[0].write(b))
      console.log('stream stuck')
    } else {
      console.log('ending client, N', N)
      cs[0].end()
    }
  })

  cs[0].on('error', function(err){
    console.log('socket write error', err.stack)
  })

  return result.promise
}

co(function *test(){

  //var us_result = yield copy_over_unix_socket()
  var tcp_result = yield copy_over_tcp_socket()

  //console.log('unix socket', fmt.apply(null, us_result))
  console.log('tcp socket', fmt.apply(null, tcp_result))
  
}).catch(function(err){
  process.nextTick(function(){
    throw err
  })
})


