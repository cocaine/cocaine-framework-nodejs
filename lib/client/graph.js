
var util = require('util')

var __stop = {value:'<stop>'}


function txFacets(graph){

  var method = {}
  var transition = {}

  for(var idx in graph){
    var idx0 = parseInt(idx)
    var methodName = graph[idx][0]
    var graph1 = graph[idx][1]

    method[methodName] = idx0

    if(graph1 === null){
      transition[methodName] = null
    } else if(Object.keys(graph1).length === 0) {
      transition[methodName] = __stop
    } else {
      transition[methodName] = txFacets(graph1)
    }
    
  }

  return {method: method, transition: transition}

}

function rxFacets(graph){

  var method = {}
  var transition = []

  for(var idx in graph){
    var idx0 = parseInt(idx)
    var methodName = graph[idx][0]
    var graph1 = graph[idx][1]

    method[methodName] = idx0

    if(graph1 === null){
      transition[idx0] = null
    } else if(Object.keys(graph1).length === 0) {
      transition[idx0] = __stop
    } else {
      transition[idx0] = rxFacets(graph1)
    }
    
  }

  return {method: method, transition: transition}

}


function smoke(){
  
  var input = {
    0:['write',null],
    1:['error',{}],
    2:['close',{}],
    3:['flow1',{
      0:['cancel', {}],
      1:['error', {}],
      2:['next', null],
      3:['switch1', {
        0:['next1',null],
        1:['cancel1',{}]
      }],
      4:['switch2', {
        0:['next2', null],
        1:['cancel2', {}]
      }]
    }],
    4:['flow2',{
      0:['cancel', {}],
      1:['error', {}],
      2:['next', null]
    }]
  }

  var out = txFacets(input)

  console.log('==== txFacets ================')
  console.log(util.inspect(out, {depth: null}))

  var out = rxFacets(input)
  console.log('==== rxFacets ================')
  console.log(util.inspect(out, {depth: null}))

  return out
  
}

module.exports = {
  facets: txFacets,
  rxFacets: rxFacets,
  txFacets: txFacets,
  smoke: smoke,
  __stop: __stop
}

if(!module.parent){
  
  smoke()
}


