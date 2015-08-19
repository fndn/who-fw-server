

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


## TODO

You can append '.json|csv|simple' to all GET requests. JSON is the default.
Example:
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.kv`
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.json`


## Notes

Using JS Date() as pr http://stackoverflow.com/questions/2943222/find-objects-between-two-dates-mongodb

**/



var mongoose 	= require('mongoose');
var bodyParser 	= require('body-parser');
var moment 		= require('moment');
var chalk 		= require('chalk');
var util 		= require('util');

var db;
var app;
var models = [];
var dbname = '';

module.exports.init = function(_app, _databaseName){

	dbname = _databaseName;
	mongoose.connect('mongodb://localhost/'+ dbname );
	db = mongoose.connection;
	db.on('error', console.error.bind(console, 'connection error:'));
	db.once('open', function (callback) {
		console.log( chalk.green("Mirror connected to Mongo") +' @'+ dbname );
	});

	app = _app;

	// set express 'sensible defaults' (optional)
	app.disable('x-powered-by');
	app.set('etag', 'strong');

	// Connect bodyParser
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());

	// Connect Middleware
	app.use(function(req, res, next){

		res.e404 = function(req) {
			res.status(404);
			res.json({'status':'error', 'msg': req.method +' '+ req.url +' : NotFound', 'code':404 });
		};

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
			res.json({'status':'error', 'msg': msg, 'code':500});
		};
		
		// log access to console
		//TODO: use logger
		console.log( req.method +' '+ req.url );

		// make sure put and post requests contain data
		if( req.method == 'PUT' || req.method == 'POST' ){
			if( Object.keys(req.body).length == 0 ){
				return res.apiError(req.method +' '+ req.url +' : no urlencoded data received (0)');
			}
		}

		next();
	});
}


module.exports.add = function(_name, fields){
	console.log( chalk.green("Mirror.add:", _name));

	var name = _name.toLowerCase();
	
	var doc = {};
	fields.forEach( function(field){
		doc[field] = ''
	})
	console.log( chalk.grey('=> '), doc);

	// add _timestamp prop to the schema. Used for both created_at and updated_at
	doc['_timestamp'] = '';
	models[name] = mongoose.model(name, mongoose.Schema(doc) );


	// api: find all
	app.get('/'+name, function(req, res){
		models[name].find( function(err, items) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:items});
		});
	});

	// api: findOne by _id
	app.get('/'+name +'/:id', function(req, res){
		models[name].findById(req.params.id).exec(function(err, item) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:item});
		});
	});

	// api: find all newer than
	app.get('/'+name +'/gte/:date', function(req, res){
		var startDate = new Date(req.params.date);
		console.log( name + " since", req.params.date, ' -> ', startDate );
		models[name].find({
			_timestamp: { $gte: startDate }
		},
		function(err, items) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:items});
		});
	});

	// api: create 
	app.put('/'+name, function(req, res){
		// only keys already defined in schema will be saved
		req.body._timestamp = new Date(); // created_at
		new models[name](req.body).save(function (err, item) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:item});
		});
	});

	// api: update one by id
	app.post('/'+name +'/:id', function(req, res){
		req.body._timestamp = new Date(); // updated_at
		models[name].findOneAndUpdate(req.params.id, req.body, {new:true, upsert:true}, function (err, item) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:item});
		});
	});

	// api: delete
	app.delete('/'+name+'/:id', function(req, res){
		console.log('delete ', req.params.id);
		models[name].findById(req.params.id).exec(function(err, item) {
			if (err) return res.apiError(err);
			if (!item) return res.e404(req);
			item.remove( function(err){
				if (err) return res.apiError(err);
				res.apiResponse({status:'ok', msg:'removed'});	
			});
		});
	});

}

