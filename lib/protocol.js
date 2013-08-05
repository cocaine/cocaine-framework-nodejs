
var RPC = [
  'handshake',
  'heartbeat',
  'terminate',
  'invoke',
  'chunk',
  'error',
  'choke'
]

var _RPC = {}

RPC.map(function(m,id){
  _RPC[m] = id
})

module.exports = {
  RPC:RPC,
  _RPC:_RPC
}