
var Q = require("q")
var co = require("..")
var argv = require("optimist").argv
var mp = require("msgpack")

var Storage = co.Service("storage")
var Logger = co.Service("logger")

var W = new co.Worker(opts)

var S,L

Q.all([Storage.resolve(),
       Logger.resolve()])
  .done(function(){
    S = new Storage()
    L = new Logger(argv.app)
    W.on("http",function(stream){
      var meta
      var body = []
      var length = 0
      stream.on("data",function(data){
        if(!meta){
          meta = mp.unpack(data)
        } else {
          body.push(data)
          length += data.length
        }
      })
      
      stream.on("end",function(){
        stream.write(
          mp.pack({code:200,
                   headers:[
                     ["content-type","text/plain"],
                     ["x-by","worker"+argv.uuid]]}))
        stream.write("that's who I am:\n")
        var m = S.read("manifests",argv.app)
        m.on("data",function(data){
          stream.write(JSON.stringify(manifests,null,2))
        })
        m.on("end",function(){
          stream.end()
        })
        m.on("error",function(error){
          stream.end(JSON.stringify(error))
        })
      })
    })
  })




