// mirror server example

var port 	= 8080;
var pack 	= require('./package.json');
var express = require('express');
var chalk 	= require('chalk');
var mirror 	= require('./mirror/main.js');

var mex 			= require('./mongo-express');
var mex_config 		= require('./mongo-express/config.default.js');
var mex_middleware 	= require('./mongo-express/middleware');

var app = express();

/*
app.use(function(req, res, next){
	console.log( req.url );
    next();
});
*/

app.get('/version', function(req, res){
	var msg = {'status':'ok', 'code':'VERSION', 'message': pack.name +' v.'+ pack.version};
	console.log( chalk.grey( msg ));
	res.json(msg);
});

//TODO: add auth middleware
//app.all('/*', authmiddelware);

// Connect mirror to express
mirror.init( app );

// Add model API
mirror.add('countries', ['name', 'countryCode']);
//mirror.add('locations', ['name', 'countryCode']);


// Connect Mongo-Express
app.use('/mex', mex_middleware(mex_config));
console.log( chalk.green("Enabling Mongo-Express on /mex") );

// Start serving
var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );
