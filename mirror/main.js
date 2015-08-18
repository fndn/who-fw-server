var mongoose 	= require('mongoose');
var bodyParser 	= require('body-parser');
var moment 		= require('moment');
var chalk 		= require('chalk');
var util 		= require('util');

mongoose.connect('mongodb://localhost/mirrordb');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
	console.log( chalk.green("Mirror connected to Mongo") +' @'+ dbname );
});


var app;
var models = [];
var dbname = '';
module.exports.init = function(_app, _databaseName){

	dbname = _databaseName;
	mongoose.connect('mongodb://localhost/'+ dbname );

	app = _app;

	// set express 'sensible defaults' (optional)
	app.disable('x-powered-by');
	app.set('etag', 'strong');

	// Connect bodyParser
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());

	// Connect Middleware
	app.use(function(req, res, next){

		res.apiResponse = function(data) {
			if (req.query.callback) {
				res.jsonp(data);
			} else {
				console.log( chalk.grey( util.inspect(data)) );
				res.json(data);
			}
		};

		res.apiError = function(msg) {
			msg = msg || 'Error';
			console.log( chalk.red('ERROR: '+ msg ));
			res.status(500);
			res.json({'status':'error', 'msg': msg});
		};
		
		next();
	});
}

/**

Usage: mirror.add('Kitten', ['name', 'age']);

This will create a Mongoose Schema with the supplied keys
and expose a REST interface to the model.

GET  /kitten 			> all
GET  /Kitten/:id 		> one
GET  /kitten/gte/:Date 	> all newer than :Date
PUT  /kitten 			> add (with req.body)
POST /kitten/:id 		> update (with req.body)
DELETE /kitten/:id 		> delete 

You can append '.json|csv|simple' to all GET requests. JSON is the default.
Example:
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.kv`
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.json`

## Notes

Using JS Date() as pr http://stackoverflow.com/questions/2943222/find-objects-between-two-dates-mongodb

**/



module.exports.add = function(_name, fields){
	console.log( chalk.green("Mirror.add:", _name));

	var name = _name.toLowerCase();
	
	var doc = {};
	fields.forEach( function(field){
		doc[field] = ''
	})
	console.log( chalk.grey('=> '), doc);

	doc['_timestamp'] = '';
	var _schema = mongoose.Schema(doc);
	

	models[name] = mongoose.model(name, _schema);

	// find all
	app.get('/'+name, function(req, res){
		console.log("Mirror GET", name, req.url );
		models[name].find( function(err, items) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:items});
		});
	});

	// findOne by _id
	app.get('/'+name +'/:id', function(req, res){
		console.log("Mirror GET", name, req.url);

		var opts = _check(req.params.id);

		console.log("req.query:", req.query, "req.params:", req.params, "req.body:", req.body, "opts:", opts );

		models[name].findById(opts.id).exec(function(err, item) {
			if (err) return res.apiError(err);
			res.json({status:'ok', msg:item});
		});
	});

	// find all newer than
	app.get('/'+name +'/gte/:date', function(req, res){
		var startDate = new Date(req.params.date);
		console.log("Mirror GET since", name, req.url, req.params.date, startDate );
		models[name].find({
			_timestamp: { $gte: startDate }
		},
		function(err, items) {
			if (err) return res.apiError(err);
			res.json({status:'ok', msg:items});
		});
	});

	// create 
	app.put('/'+name, function(req, res){
		var entry = req.body; // only keys already defined in schema will be saved
		
		entry['_timestamp'] = new Date();
		

		if( Object.keys(entry).length == 1 ){
			return res.apiError(req.method +' '+ req.url +' : no urlencoded data received');
		}
		new models[name](entry).save(function (err, item) {
			if (err) return res.apiError(err);
			res.json({status:'ok', msg:item});
		});
	});

	//TODO update one by id
	app.post('/'+name +'/:id', function(req, res){
		console.log("Mirror POST", name, req.params, req.body );
		
		models[name].findOneAndUpdate({id:req.params.id}, req.body, {upsert:true}, function (err, item) {
			if (err) return res.apiError(err);
			console.log("TODO Mirror: Updated ", item);
			res.json({status:'ok', msg:item});
		});
	});

	//TODO (as we want to conform to the JSON API Schema)
	// app.options()
}

