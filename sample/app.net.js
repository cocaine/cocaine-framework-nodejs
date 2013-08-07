#!/usr/bin/node

var co = require('..')
var argv = require('optimist').argv
var mp = require('msgpack')
var __assert = require('assert')
var crypto = require('crypto')
var net = require('net')

var S,L,W

co.getServices(['storage','logging'],function(Storage,Logger){
  S = new Storage()
  L = new Logger(argv.app)

  W = new co.Worker(argv)
  W.listen()
  var handle = W.getListenHandle('hash')
  var server = net.createServer()

  server.listen(handle)
  
  server.on('connection',function(c){
    L.debug('got node.net request')
    var sha512 = crypto.createHash('sha512')
    c.resume()
    c.on('data',function(data){
      var d = sha512.digest('hex')+'\n'
      sha512.update(data)
      c.write(d)
    })
    c.on('end',function(){
      var d = sha512.digest('hex')+'\n'
      c.end(d)
    })
  })

  server.on('close',function(){
    console.log('worker terminating')
    S.close()
    L.close()
    process.exit(0)
  })

})




