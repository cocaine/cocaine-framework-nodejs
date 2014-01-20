

var cli = new (require('../lib/client/client').Client)(['10.11.12.13', 10053])


cli.getServices(['urlfetch'], function(err, urlfetch){
  if(err){
    console.log('error resolving some of services', err)
    return 
  }

  urlfetch.get('http://ya.ru', 3000, {}, {}, true, function(err, result){
    console.log(arguments)
  })

})

