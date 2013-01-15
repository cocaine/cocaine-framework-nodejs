
function App(Server){
  
  Server.on("request",function(rq,rs){
    var body=""
    rq.on("data",function(chunk){
      body+=chunk})
    rq.on("end",function(){
      rs.writeHead(200,{
        "content-type":"text/plain",
        "x-anything":"by-chip-n-dale"})
      rs.write(new Date().toString())
      rs.end()
    })
  })

  Server.on("terminate",function(){
    //some cleanup
  })
  
}


exports={
  App:App
}



