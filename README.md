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

Since the app.js has to be an executable, we put shebang on the first line
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
#!/path/to/node

cocaine.getServices(['geobase','uatraits','logging'], function(geo,ua,log){
    
    var server = new http.Server(function(req, res){
        req.on('data', function(data){
            body.push(data)
        })
        
        req.on('end', function(){      
            var names
            geo.region_id(req.headers['x-real-ip'])
                .then(function(regionId){
                    log.debug('found region %d for %s', regionId, req.headers['x-real-ip'])
                    return geo.names(regionId)
                })
                .then(function(names0){
                    log.debug('names for region %d are %s', regionId, names0.join())
                    names = names0
                    return geo.coordinates(regionId)
                })
                .then(function(coords){
                    log.debug('coordinates for region %d are %s', regionId, coords.join())
                    res.end('You could be somewhere around '+
                            names.join() + ' which is at ' + coords)
                })
        })
    })
    
    log.info('cocaine worker', argv.uuid, 'starting')
    
    server.listen(handle)

})

```

See [3] for complete sources.

### Use Cocaine services from the outside of the cloud

To fully control the client-side services lifetime flow, you can use
Client. It resolves services for you, keeps services cache, and resets
resolved services cache on locator disconnect.

```js
var cli = new require('cocaine').Client()

var Storage = cli.resolve('storage')

var storage0 = new Storage()

storage0.on('error', function(err){
    // reconnect on network error
})

storage0.connect()

storage0.on('connect', function(){
    storage0.write('collection','key','value')
        .then(function(){
            console.log(
        })
})
```

See [4] for examples of fine-grained services usage.

### Access your application as a Cocaine service

```js
var cli = new require('cocaine').Client()
var App = cli.resolve('the_app')

var app0 = new App()
app0.connect()

app0.on('connect', function(){
    app0.enqueue('handle','anydata')
})

```

## References

[1] http://nodejs.org/api/net.html#net_server_listen_handle_callback

[2] http://github.com/diunko/cocaine-sample-app/blob/master/app.js
