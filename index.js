
var express     = require('express');
var fs 			= require('fs');
var chalk 		= require('chalk');

var port = 8080;
var _package = require('./package.json');
var identity = _package.name;
var version  = _package.version;

var app = express();
app.disable('x-powered-by');
app.set('etag', 'strong');

app.use(function(req, res, next){
	console.log( req.url );
    next();
});
app.get('/version', function(req, res){
	res.json({'status':'ok', 'code':'VERSION', 'message': identity+' v.'+version});
});
app.post('/upload', function(req, res) {
    console.log(JSON.stringify(req.files));
});


var server = app.listen( port );
console.log("Running '"+ identity +"' v."+ version +' on port '+ port );
