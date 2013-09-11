
var _ = require('../service')
var Service = _.Service
var method = _.method

var Uatraits = 
  Service.def('uatraits',{
    methods:{
      detect: method.unpacking,
      detect_by_headers: method.unpacking
    }
  })

module.exports = Uatraits

