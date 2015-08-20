// mirror server example

var port = 8080;

var express = require('express');
var chalk 	= require('chalk');
var pack 	= require('./package.json');
var mirror 	= require('./mirror/main.js')
var mex 	= require('./mongo-express');
var mex_cnf = require('./mongo-express/config.default.js');
var mex_mw 	= require('./mongo-express/middleware');

var app = express();


app.use(function(req, res, next){
	// log access to console
	//console.log("MY", req.method +' '+ req.url );
	next();
})

app.get('/version', function(req, res){
	res.json({'status':'ok', 'code':'VERSION', 'message': pack.name +' v.'+ pack.version});
});

//TODO: add auth middleware
//app.all('/*', authmiddelware);

// Connect mirror to express
mirror.init( app, 'who-fw-dev' );

// Add model API
mirror.add('countries', ['name', 'countryCode', 'removed']);
mirror.add('testing', ['name']);


// Connect Mongo-Express
app.use('/mex', mex_mw(mex_cnf));
console.log( chalk.green("Enabling Mongo-Express on /mex") );


app.get('/*', function(req, res){
	res.json({'status':'ok', 'code':'DEFAULT', 'message': pack.name +' v.'+ pack.version});
});


// Start serving
var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );
