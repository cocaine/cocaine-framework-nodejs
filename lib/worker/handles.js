
var v = process.version.slice(1).split('.')

if(0 < parseInt(v[0]) || v[1] === '12'){
  
  module.exports = require('./handles2')
  
} else if(v[1] === '10'){
  
  module.exports = require('./handles1')
  
} else {
  throw new Error('engine not supported: ' + process.version)
}


