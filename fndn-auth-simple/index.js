require('dotenv').load();

var tokens 		 = process.env.TOKENS;
var valid_tokens = tokens ? tokens.split(",") : [];
console.log('valid_tokens', valid_tokens);

module.exports = function(){

	return function(req, res, next){
		
		// separate requests in the log
		console.log(" ");

		// ignore favicon
		if (req.path === '/favicon.ico') {
			res.writeHead(200, {'Content-Type': 'image/x-icon'} );
			res.end();
			return;
		}
		
		console.log('---------------------------------------------------------------------');
		console.log("> ", req.url );

		var remote_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		console.log('remote_ip:', remote_ip );

		var token = req.headers['x-auth-token'];
		console.log('token:', token );
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
		
	}
};