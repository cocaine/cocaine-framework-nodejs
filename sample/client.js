
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

})


