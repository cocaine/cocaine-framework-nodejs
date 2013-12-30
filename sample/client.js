
var net = require('net')
var argv = require('optimist').argv
var q = require('q')

var mp = require('msgpack')

var co = require('..')

co.getServices(['storage'], function(storage){

  storage.find('manifests',['app'])
    .then(function(result){
      console.log(result)
    })

  // the code below would be needed instead if we don't define .find as
  // unpacking method of 'storage' service:

  // var session = storage.find('manifests',['app'])
  // session.on('data', function(data){
  //   console.log(mp.unpack(data))
  // })

  // session.on('end', function(){
  //   console.log('done!')
  // })

  // session.on('error', function(err){
  //   console.log('error in storage service', err)
  // })

})


