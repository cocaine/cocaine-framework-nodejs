
// verbosity levels map
var VL = [ 
  "ignore",
  "error",
  "warn",
  "info",
  "debug"
]

var _VL = {}
VL.map(function(level,i){
  _VL[level] = i
})

var Logger = Service.def("logging",{
  __init:function Logger(app){
    Client.apply(this,arguments)
    this._level = _VL.warn
    this._target = "app/" + app
    this.connect()
    this.verbosity()
  },
  methods:{
    emit:method.oneoff,
    verbosity:function(mid){
      var unpack_ = method.unpacking(mid)
      return function(){
        var self = this
        return unpack_.apply(this,arguments)
          .done(function(result){
            var verbosity = result[0]
            self._level = verbosity
          })
      }
    }
  }
})

VL.forEach(function(name,level){
  Logger.prototype[name] = function(message){
    if(this._level <= level){
      this.emit(level,this._target,message)
    }
  }
})

module.exports = Logger

