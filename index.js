
require('dotenv').load();

var port = process.env.PORT || 8080;

var express = require('express');
var chalk 	= require('chalk');
var path 	= require('path');
var fs 		= require('fs');
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

	// separate requests in the log
	console.log(" ");

	// ignore favicon
	if (req.path === '/favicon.ico') {
		res.writeHead(200, {'Content-Type': 'image/x-icon'} );
		res.end();
		return;
	}
	

	var remote_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	//console.log('remote_ip:', remote_ip );

	var token = req.headers['x-auth-token'];
	//console.log('token:', token );
	//console.log('req.headers', req.headers );

	if( req.path.split("/")[1] === 'pub' ){
		console.log("⌥ auth: bypassing auth for public endpoints");
		next();

	}else if( remote_ip.indexOf('127.0.0.1') > -1 || remote_ip.indexOf('169.254.') > -1 ){
		console.log("⌥ auth: bypassing auth for localhost");
		next();
	
	}else if( valid_tokens.indexOf(token) > -1 ){
		console.log("⌥ auth: access allowed by token");
		next();

	}else{
		console.log("⌥ auth: access denied");
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

/// SSL
port = 443;
var hostname = 'fndn.dk';

var certsd = '/etc/sslmate/';
if( __dirname.indexOf('/Users/js/') === 0 ){
	certsd = '/Users/js/Dropbox/foundation/certs/sslmate/';
}

console.log('certsd', certsd);



/// Start server
if( port == 443 ){
	/// HTTPS
	var https = require("https");
	var httpsOpts = {
		//
		// disable SSLv3, "POODLE"
		// https://disablessl3.com/#nodejs
		// https://gist.github.com/3rd-Eden/715522f6950044da45d8
		//secureProtocol: 'SSLv23_method',			
		//secureOptions: constants.SSL_OP_NO_SSLv3,

		hostname: hostname,
		key:  fs.readFileSync( certsd +'*.'+ hostname +'.key').toString(), // "/ssl.key" ),
		cert: fs.readFileSync( certsd +'*.'+ hostname +'.crt').toString(), // "/ssl.crt" ),
		ca:   fs.readFileSync( certsd +'*.'+ hostname +'.chained.crt').toString() // "/ca.pem"  )
	}
	var server = https.createServer( httpsOpts, app).listen( port );

	//console.log('httpsOpts:', httpsOpts);
	//console.log('server:', server);

}else{
	/// HTTP
	var server = app.listen( port );
}

////
// Start serving
//var server = app.listen( port );
console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );


