
var co = require('..')
var argv = require('optimist').argv
var mp = require('msgpack')

var Storage = co.Service('storage')
var Logger = co.Service('logging')

var W = new co.Worker(argv)

var S = new Storage()
var L = new Logger(argv.app)

W.on('http',function(stream){
  L.debug('got http event')
  var meta
  var body = []
  var length = 0
  stream.once('data',function(data){
    if(!meta){
      meta = mp.unpack(data)
      L.debug('received header')
    } else {
      var name = 'request'+Date.now().toString()
      L.debug('writing body to storage as ' + name)
      stream.pipe(S.write('requests',name))
    }
  })
  
  stream.on('end',function(){
    L.debug('request saved')
    stream.write(
      mp.pack({code:200,
               headers:[
                 ['content-type','text/plain'],
                 ['x-by','worker'+argv.uuid]]}))
    stream.write('that\'s who I am:\n')
    S.read('manifests',argv.app).pipe(stream)
    L.debug('all done')
  })
  
})





