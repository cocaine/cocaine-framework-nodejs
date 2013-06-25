
var v = process.version.slice(1).split(".")
if(v[1] === "10"){
  module.exports = require("./session2")
} else if(v[1] === "8"){
  module.exports = require("./session1")
} else {
  throw new Error("engine not supported: " + process.version)
}


