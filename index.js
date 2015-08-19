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

app.get('/version', function(req, res){
	res.json({'status':'ok', 'code':'VERSION', 'message': pack.name +' v.'+ pack.version});
});

//TODO: add auth middleware
//app.all('/*', authmiddelware);

// Connect mirror to express
mirror.init( app, 'who-fw-dev' );

// Add model API
mirror.add('countries', ['name', 'countryCode']);
//mirror.add('locations', ['name', 'countryCode']);


// Connect Mongo-Express
app.use('/mex', mex_mw(mex_cnf));
console.log( chalk.green("Enabling Mongo-Express on /mex") );

// Start serving
var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );
