

var Session = require('../lib/client/session').Session


function Pipe(s1, s2){

  var self = this

  this._hdl1 = {
    _send: function(m){
      process.nextTick(function(){
        s2.push(m)
      })
    }
  }
  
  this._hdl2 = {
    _send: function(m){
      process.nextTick(function(){
        s1.push(m)
      })
    }
  }

  s1._owner = this._hdl1
  s2._owner = this._hdl2
  
}

function a(){
  var rx = {
    0:['ping', null],
    1:['close', {}],
    2:['close_ack', {}]
  }
  var tx = {
    0:['ping', null],
    1:['close', {}],
    2:['close_ack', {}]
  }

  var s1 = new Session(123, tx, rx)

  var s2 = new Session(123, rx, tx)

  var p = new Pipe(s1, s2)

  var N = 10

  s1.recv({
    ping: function(n){
      if(n<N){
        s1.send.ping(n+1)
      } else {
        s1.send.close()
      }
    },
    close: function(){
      console.log('close')
    },
    close_ack: function(){
      console.log('close_ack')
    }
  })

  s2.recv({
    ping: function(n){
      s2.send.ping(n+1)
    },
    close: function(){
      console.log('close')
      s2.send.close_ack()
    }
  })

  s1.send.ping(1)
}


var tests = [
  function(){
    var rx = {
      0:['ping', null],
      1:['next', {
        0: ['skip', null],
        1: ['bla', null],
        2: ['next', {
          0:['bla', null],
          1:['bee', null],
          2:['foo', null],
          3:['next', {
            0: ['close', {}]}]}]}]}

    var tx = {
      0:['ping', null],
      1:['next', {
        0: ['skip', null],
        1: ['bla', null],
        2: ['next', {
          0:['bla', null],
          1:['bee', null],
          2:['foo', null],
          3:['next', {
            0: ['close', {}]}]}]}]}

    var s1 = new Session(123, tx, rx)

    var s2 = new Session(123, rx, tx)

    var p = new Pipe(s1, s2)

    var N = 10

    s1.recv({
      ping: function(n){
        if(n<N){
          s1.send.ping(n+1)
          console.log('ping sent',n+1)
        } else {
          console.log('no more pings')
          s1.send.next()
          s1.recv({
            next: function(){
              console.log('s1.next1')
              s1.send.next()
              s1.recv({
                next: function(){
                  console.log('s1.next2')
                  s1.send.next()
                  s1.recv({
                    next: function(){
                      console.log('s1.next3')
                      s1.send.close()
                      s1.recv({
                        close:function(){
                          console.log('s1.close')
                          console.log('s1 done')}})}})}})}})}}})

    s2.recv({
      ping: function(n){
        s2.send.ping(n+1)
        console.log('ping sent',n+1)
      },
      next: function(){
        console.log('s2.next1')
        s2.send.next()
        s2.recv({
          next: function(){
            console.log('s2.next2')
            s2.send.next()
            s2.recv({
              next: function(){
                console.log('s2.next3')
                s2.send.next()
                s2.recv({
                  close:function(){
                    console.log('s2.close')
                    s2.send.close()
                    console.log('s2 done')}})}})}})}})

    s1.send.ping(0)
  }
]

function smoke(){
  tests.some(function(t){
    console.log('================')
    t()
  })
}


smoke()

