

var _ = require("../service")
var Service = _.Service
var method = _.method

var Locator = Service.def("locator",{
  methods:{
    resolve:method.unpacking
  }
})

Locator.resolve([["127.0.0.1",10053],1,["resolve"]])

module.exports = Locator

