
require('dotenv').load();

var port 		= process.env.PORT || 443;
var devport 	= process.env.DEVPORT || 8090;
var hostname 	= process.env.HOSTNAME || 'localhost';

var express 	= require('express');
var chalk 		= require('chalk');
var helmet 		= require('helmet');
var path 		= require('path');
var fs 			= require('fs');
var pack 		= require('./package.json');
var mirror 		= require('./mirror/main.js')
var mex 		= require('./mongo-express');
var mex_cnf 	= require('./mongo-express/config.default.js');
var mex_mw 		= require('./mongo-express/middleware');
var sauth 		= require('./fndn-auth-simple/');

var app = express();

app.get('/version', function(req, res){
	res.json({'status':'ok', 'code':'VERSION', 'message': pack.name +' v.'+ pack.version});
});



// Connect Mongo-Express
console.log( chalk.green("Starting Mongo-Express on /mex") );
app.use('/mex', mex_mw(mex_cnf));

// Connect Simple Auth
console.log( chalk.green("Enabling Simple Auth") );
app.use( sauth() );

// Connect Mirror
mirror.init( app, 'fwa-151008' );

// Configure Mirror
// Table list from Client's Datastore.Config:
var tables = ["countries", "locations", "brands", "incomeTypes", "storeTypes", "storeBrands", "ageGroups", "products", "register", "images", "currencies"];

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

// Start Server

// localhost dev without ssl
if( __dirname.indexOf('/Users/js/') === 0 ) port = devport;

/// Start server
if( port == 443 ){

	var certsd = '/etc/sslmate/';

	var httpsOpts = {

		hostname: hostname,
		key:  fs.readFileSync( certsd +'*.'+ hostname +'.key').toString(),
		cert: fs.readFileSync( certsd +'*.'+ hostname +'.crt').toString(),
		ca:   fs.readFileSync( certsd +'*.'+ hostname +'.chain.crt').toString(),

		// https://certsimple.com/blog/a-plus-node-js-ssl
		// default node 0.12 ciphers with RC4 disabled
		ciphers: [
			"ECDHE-RSA-AES256-SHA384",
			"DHE-RSA-AES256-SHA384",
			"ECDHE-RSA-AES256-SHA256",
			"DHE-RSA-AES256-SHA256",
			"ECDHE-RSA-AES128-SHA256",
			"DHE-RSA-AES128-SHA256",
			"HIGH",
			"!aNULL",
			"!eNULL",
			"!EXPORT",
			"!DES",
			"!RC4",
			"!MD5",
			"!PSK",
			"!SRP",
			"!CAMELLIA"
		].join(':'),
		honorCipherOrder: true
	};

	app.use( helmet.hsts({
		maxAge: 31536000000,
		includeSubdomains: true,
		force: true
	}));

	var https  = require("https");
	var server = https.createServer( httpsOpts, app).listen( port );
	console.log( chalk.green("Enabled SSL") +" with certs from", certsd );

}else{
	/// HTTP
	var server = app.listen( port );
}

console.log("Running '"+ pack.name +"' v."+ pack.version +' on port '+ port );


