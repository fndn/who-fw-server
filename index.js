
require('dotenv').load();

var port = process.env.PORT || 8080;

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


// Connect Mongo-Express
app.use('/mex', mex_mw(mex_cnf));
console.log( chalk.green("Starting Mongo-Express on /mex") );


// *Simple* auth
var valid_tokens = process.env.TOKENS.split(",");

app.all('/*', function(req, res, next){

	var reqpath = ''+ req.path;
	//console.log('reqpath:', reqpath);

	if (reqpath === '/favicon.ico') {
		//console.log('favicon requested');
		res.writeHead(200, {'Content-Type': 'image/x-icon'} );
		res.end();
		return;
	}
	

	var remote_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	//console.log('remote_ip:', remote_ip );

	var token = req.headers['x-auth-token'];
	//console.log('token:', token );
	//console.log('req.headers', req.headers );

	if( reqpath.split("/")[1] === 'pub' ){
		console.log("bypassing auth for public endpoints");
		next();

	}else if( remote_ip.indexOf('127.0.0.1') > -1 || remote_ip.indexOf('169.254.') > -1 ){
		console.log("bypassing auth for localhost");
		next();
	
	}else if( valid_tokens.indexOf(token) > -1 ){
		console.log("auth by token");
		next();

	}else{
		console.log("access denied");
		res.send({"status":"error", "msg":"access denied"});
	}
});


// Connect mirror to express
mirror.init( app, 'whofw-dev-100' );

// Table list from Client's Datastore.Config:
var tables = ["countries", "locations", "brands", "incomeTypes", "storeTypes", "storeBrands", "ageGroups", "products", "registrations", "images"];

tables.forEach( function(t){
	mirror.add(t, []); // using loose schemas
});
/*
// Add model APIs
mirror.add('countries', 	['removed', 'name', 'countryCode']);
mirror.add('locations',		['removed', 'name', 'neighbourhood', 'street', 'incomeType', 'countryId']);
mirror.add('incomeTypes', 	['removed', 'name']);
mirror.add('storeTypes', 	['removed', 'name']);
mirror.add('brands', 		['removed', 'name']);
mirror.add('registrations',	['removed', 'name']);

mirror.add('testing', 		['removed', 'name']);
*/


// Start serving
var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );
