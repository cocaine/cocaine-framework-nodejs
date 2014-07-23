
var __assert = require('assert')

var linkProtoProps = require('../lib/util').linkProtoProps

function chain(oo){
  for(var i=1;i<oo.length;i++){
    oo[i-1].__proto__ = oo[i]
  }
  return oo[0]
}

describe('linkProtoProps', function(){

  it('really chains', function(){

    var o = chain([{a:10}, {b:20}, {c:30}, {d:40}])

    __assert(o.b === 20)
    __assert(o.c === 30)
    __assert(o.d === 40)
    
  })

  it('should link props', function(){

    var o = chain([{options:{a:10}},
                {options:{b:20}},
                {options:{c:30}},
                {options:{d:40}},
                {options:{e:50}}])

    linkProtoProps(o, 'options')

    __assert(o.options.e === 50)
    
  })


  it('should link chains with some props missing', function(){

    var o = chain([{options:{a:10}},
                {options:{b:20}},
                {},
                {options:{d:40}},
                {},
                {options:{e:50}}])

    linkProtoProps(o, 'options')

    __assert(o.options.b === 20)
    __assert(o.options.e === 50)
    
  })
  
  it('should stop linking on first non-object prop', function(){

    var o = chain([{options:{a:10}},
                {options:{b:20}},
                {},
                {options:{d:40}},
                {options:null},
                {options:{e:50}}])

    linkProtoProps(o, 'options')

    __assert(o.options.b === 20)
    __assert(o.options.d === 40)
    __assert(o.options.e === undefined)
    
  })
  
  
})


