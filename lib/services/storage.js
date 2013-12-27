
var _ = require('../service')
var Service = _.Service
var method = _.method

var Storage = 
  Service.def('storage',{
    methods:{
      read:method.streaming,
      write:method.confirmed,
      find:method.unpacking,
      remove:method.confirmed
    }
  })

module.exports = Storage

