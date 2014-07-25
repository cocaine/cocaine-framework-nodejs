
# Cocaine NodeJS Framework

## Examples of usage

### Create NodeJS app for Cocaine cloud

Let's start with simple NodeJS http application.

```js
var http = require('http')

var server = new http.Server(function(req, res){
    var body = []
    req.on('data', function(data){
        body.push(data)
    })
    req.on('end', function(){
        res.writeHead(200, {
          'x-any-header': 'x-any-value',
          'content-type': 'text/plain'
        })
        res.end('hello, Cocaine!')
    })
})

server.listen(8080)
```

To get our app working in Cocaine cloud, let's add just a couple of things.

```js
#!/path/to/node
var cocaine = require('cocaine')
var http = cocaine.http // monkey-patches node's original http server

var argv = require('optimist').argv //which is actually a hash
// looking like { opt: 'value'}

var worker = new cocaine.Worker(argv)

var handle = worker.getListenHandle("http") // the handle implements a
// low-level nodejs' listening tcp socket, and it makes nodejs
// understand cocaine streams.

var server = new http.Server(...) // the same thing as above

server.listen(handle) // as per [1], start listening on cocaine handle
```

To let the cocaine-runtime know what to run in our app, we put
manifest.json:

```js
{ "slave":"app.js" }
```

Since the app.js has to be an executable, we put shebang on first line
and don't forget about setting an executable bit.

See the complete app here [2].

### Deploy app to the cloud

```bash
git clone url/the_app
cd the_app
npm install
tar -czf ../the_app.tgz
cocaine-tool app upload -n the_app --package ../the_app.tgz --manifest manifest.json
>app the_app has been successfully uploaded
```

then,

```bash
cocaine-tool app start -n the_app -r default
>app the_app started
curl -v http://<cloud.front>/the_app/http/
>...
```

### Make use of Cocaine services

```js

var cocaine = require("cocaine")

var cli = new cocaine.Client(["localhost", 10053])

var log = new cli.Logger("myprefix") // logs lines like "myprefix/..."

cli.on('error', function(err){
    console.log('client error', err)
})

log.on('error', function(err){
    console.log('logger error', err)
})


log.connect()

log.on("connect", function() {

    cli.getServices(['geobase'], function(err, geo, ua){
        var names
        
        log.info("looking up regionId for ip 1.2.3.4")
        
        geo.region_id("1.2.3.4", function(err, regionId) {
            if(err) return _handleError(err)

            log.debug("found region %d for %s", regionId, "1.2.3.4")

            geo.names(regionId, function(err, names){
                if(err) return _handleError(err)

                log.debug("names for region %d are %s", regionId, names.join())

                geo.coordinates(regionId, function(coords){
                    if(err) return _handleError(err)

                    log.debug('coordinates for region %d are %s', regionId, coords.join())

                })
            })
        })
    })
})

function _handleError(err){
    console.log('service error', err)
}
```

See
 [client-simple](http://github.com/cocaine/cocaine-framework-nodejs/blob/master/sample/client.0.js)
 for complete source of the simplest cocaine client app.

### Use Cocaine services from the outside of the cloud

To fully control a client to services, you can use
Client. It resolves services for you, keeps services cache, and resets
resolved services cache on locator disconnect.


```js
var cli = new require('cocaine').Client()

var storage = cli.Service('storage')

storage.on('error', function(err){
    // reconnect on network error
})

storage.connect()

storage.on('connect', function(){
    storage0.write('collection','key','value', function(err){
        if(err){
            console.log('error writing to storage', err)
            return
        }
        
        console.log(done 'writing to storage')
    })
})
```

See [client-reconnect](http://github.com/cocaine/cocaine-framework-nodejs/sample/client.1.js)
for example of handling various socket-level failures when connecting
and communicating to locator and target services.

### Access your application as a Cocaine service

```js
var cli = new require('cocaine').Client()
var app = cli.Service('the_app', 'app')

app.connect()

app.on('connect', function(){
  var s = app.enqueue(
    'http', 
    mp.pack(['GET',       // http method
             '/',         // uri
             'HTTP/1.0',  // http version
             [['some-header','value']],  // tuple of header-value pairs
             '']))  // body of request

  var header
  var body = []

  s.on('data', function(chunk){
    console.log('reply chunk', chunk)
    var data = mp.unpack(chunk)
    console.log('  which decodes', data)
    if(header === undefined){
      console.log('header')
      header = data
    } else {
      console.log('body chunk')
      body.push(data)
    }
  })

  s.on('end', function(){
    console.log('reply done')
  })

  s.on('error', function(err){
    console.log('reply error', err)
  })
  
})

```

## References

[1] http://nodejs.org/api/net.html#net_server_listen_handle_callback

