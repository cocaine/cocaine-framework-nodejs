#!/usr/bin/env node

var co = require('..')
var mp = require('msgpack')
var net = require('net')
var Readable = require('stream').Readable

co.getServices(['node_hash'],function(Hash){
  var H = new Hash()
  var rq = [
    'GET / HTTP/1.1',
    'User-Agent: curl/7.19.7 (x86_64-pc-linux-gnu) libcurl/7.19.7 OpenSSL/0.9.8k zlib/1.2.3.3 libidn/1.15',
    'Host: 127.0.0.1:8181',
    'Accept: */*','',''].join('\r\n')
  
  var r = H.invoke('net',Buffer(rq))
  var head
  r.on('data',function(chunk){
    if(!head){
      head = mp.unpack(chunk)
      console.log(head)
    } else {
      console.log('data:',chunk.toString())
    }
  })
  r.on('end',function(){
    console.log('end')
  })

})






