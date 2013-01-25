
var fs=require("fs")

function Log(path){
  this._f=fs.createWriteStream(
    path,
    {flags:"a",
     encoding:"utf8",
     mode:0666})
}

Log.prototype={
  log:function(){
    this._f.write(Array.prototype.join.call(arguments," ")+"\n")
  }
}

module.exports=Log


