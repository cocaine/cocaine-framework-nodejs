
var _ = require('../service')
var Service = _.Service
var method = _.method

var Langdetect = 
  Service.def('langdetect',{
    methods:{
      find_domain: method.unpacking,
      find_language: method.unpacking,
      list_languages: method.unpacking,
      cookie2language: method.unpacking,
      language2cookie: method.unpacking
    }
  })

module.exports = Langdetect 

