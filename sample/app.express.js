#!/opt/nodejs/0.10/bin/node

/**
 * Module dependencies.
 */

var express = require('express'),
    app = express(),
    argv = require('optimist').argv;
    
argv.uuid && app.set('env', 'cocaine');

// all environments
//app.use(express.favicon());
//app.use(express.logger('dev'));
//app.use(express.bodyParser());
//app.use(express.methodOverride());
app.use(express.static(__dirname + '/public'));
//app.use(express.errorHandler());

// cocaine only
if (app.get('env') == 'cocaine') {

    var cocaine = require('cocaine'),
        http = cocaine.http,
        Worker = new cocaine.Worker(argv),
        handle = Worker.getListenHandle('http');

    app.set('handle', handle);

    var server = new http.Server(app);

} else {

    var http = require('http');

    app.set('handle', process.env.PORT || 3000);

    var server = http.createServer(app);

}

app.get('/bla', function(req, res) {
   res.send('bla');
});

server.listen(app.get('handle'), function() {
    console.log('Express server listening on ' +
        (typeof app.get('handle') === 'number' ?
            'port ' + app.get('handle') :
            'cocane handle'));
});
