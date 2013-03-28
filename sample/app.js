
function App(Server,options){

  var S=new Server()
  S.bind(options)
  console.log("bound")
  S.on("request",function (rq,rs){
    console.log("js got request")
    var body=""
    
    rq.on("data",function(chunk){
      console.log("js got body chunk")})
    
    rq.on("end",function(){
      console.log("js got end")
      rs.writeHead(200,{
        "content-type":"text/plain",
        "x-anything":"by-chip-n-dale"})
      
      rs.write(new Date().toString())
      rs.end()
    })
  })
  
  return S
  
}

module.exports=App



