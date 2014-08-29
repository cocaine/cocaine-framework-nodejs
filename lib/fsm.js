
var __assert = require('assert')
var format = require('util').format
var EventEmitter = require('events').EventEmitter

var util = require('./util')

var trace = 0
var debug = require('./util').debug('co:fsm')


function define(def){
  function FSM(){
    EventEmitter.apply(this, arguments)
    def.methods.__init__ && def.methods.__init__.apply(this, arguments)
    this._state = def.startState || 'start'
    this._handle = null
    this._error = null
    this.__sid = 0
  }

  var proto = FSM.prototype = {
    __proto__: FSMPrototype,
    __fsmdef: def.states,
    _emit: EventEmitter.prototype.emit
  }

  if(def.handlers){
    proto.handlers = def.handlers
  }
  
  for(var methodName in def.methods){
    proto[methodName] = def.methods[methodName]
  }

  for(var state in def.states){
    var stateDef = def.states[state]
    for(var methodName in stateDef.methods){
      if(!(methodName in proto)){
        proto[methodName] = makeMethod(methodName)
      }
    }
  }

  return FSM
  
  function makeMethod(name){
    return function method(){
      debug('<state %s>: calling method %s', this._state, name)
      var stateDef = this.__fsmdef[this._state]
      if(trace){
        __assert(stateDef, format('current <state %s> is not defined', this._state))
        if(stateDef.invariant){
          __assert(stateDef.invariant.call(this),
                   format(
                     '<state %s> invariant doesn\'t hold: %s',
                     this._state, stateDef.invariant))}
        __assert(typeof stateDef.methods[name] === 'function',
                 format(
                   '<state %s>: no method %s ',
                   this._state, name))}
      var method = stateDef.methods[name]
      __assert(typeof method === 'function',
               format('<state %s>: no method %s for state',
                      this._state, name))
      return method.apply(this, arguments)
    }
  }
  
}

var FSMPrototype = {
  __proto__: EventEmitter.prototype,

  _setState: function(state){
    debug('state: %s->%s', this._state, state)
    if(this._state === state) return 
    var stateDef0 = this.__fsmdef[this._state]
    var stateDef1 = this.__fsmdef[state]
    __assert(stateDef0, format('current <state %s> is not defined', this._state))
    __assert(stateDef1, format('new <state %s> is not defined', state))
    if(!this._handle){
      debug('this._handle false-ish')
      __assert(!stateDef1.handlers,
               format('<state %s> -> <state %s>: handlers defined for null handle',this._state, state))
      this._state = state
    } else {
      debug('this._handle true-ish')
      this._state = state
      debug('unsetting handlers', stateDef0.handlers)
      util.unsetHandlers(this._handle, stateDef0.handlers)
      debug('setting handlers', stateDef1.handlers)
      util.setHandlers(this._handle, stateDef1.handlers)
    }
  }
  
}

module.exports = {
  define: define
}

