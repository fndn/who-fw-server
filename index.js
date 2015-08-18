// mirror server example

var port 	= 8080;
var pack 	= require('./package.json');
var express = require('express');
var chalk 	= require('chalk');
var mirror 	= require('./mirror/main.js');

var app = express();

app.use(function(req, res, next){
	console.log( req.url );
    next();
});

app.get('/version', function(req, res){
	res.json({'status':'ok', 'code':'VERSION', 'message': pack.name +' v.'+ pack.version});
});

//TODO: add auth middleware
//app.all('/*', authmiddelware);

// connect mirror to express
mirror.init( app );

// Add model API
mirror.add('Kitten', ['name', 'age']);

// Start serving
var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );
