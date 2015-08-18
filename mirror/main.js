var mongoose 	= require('mongoose');
var bodyParser 	= require('body-parser');
var moment 		= require('moment');
var chalk 		= require('chalk');

mongoose.connect('mongodb://localhost/mirrordb');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
	console.log( chalk.green("Mirror connected to Mongo"));
});


var app;
var models = [];
module.exports.init = function(_app){
	app = _app;

	// set express 'sensible defaults' (optional)
	app.disable('x-powered-by');
	app.set('etag', 'strong');

	// 
	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(bodyParser.json());
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
	doc['_timestamp'] = '';
	var _schema = mongoose.Schema(doc);

	models[name] = mongoose.model(name, _schema);

	// find all
	app.get('/'+name, function(req, res){
		console.log("Mirror GET", name, req.url );
		models[name].find( function(err, items) {
			if (err) return console.error(err);
			
			console.log(items);
			res.json({status:'ok', msg:items});
		});
	});

	// findOne by _id
	app.get('/'+name +'/:id', function(req, res){
		console.log("Mirror GET", name, req.url);

		var opts = _check(req.params.id);

		console.log("req.query:", req.query, "req.params:", req.params, "req.body:", req.body, "opts:", opts );

		models[name].findById(opts.id).exec(function(err, item) {
			if (err){
				_error(res, err.message, opts);
				return console.log( chalk.grey(err) );
			}
			
			console.log( chalk.grey(item) );
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
			if (err) return console.error(err);
			
			console.log(items);
			res.json({status:'ok', msg:items});
		});
	});

	// create 
	app.put('/'+name, function(req, res){
		var entry = req.body; // only keys already defined in schema will be saved
		
		entry['_timestamp'] = new Date();
		
		console.log("Mirror PUT", name, entry );
		new models[name](entry).save(function (err, item) {
			if (err) return console.error(err);
			console.log("Mirror: Added ", item);
			res.json({status:'ok', msg:item});
		});
	});

	//TODO update one by id
	app.post('/'+name +'/:id', function(req, res){
		console.log("Mirror POST", name, req.params, req.body );
		
		models[name].findOneAndUpdate({id:req.params.id}, req.body, {upsert:true}, function (err, item) {
			if (err) return console.error(err);
			console.log("Mirror: Updated ", item);
			res.json({status:'ok', msg:item});
		});
	});

	//TODO (as we want to conform to the JSON API Schema)
	// app.options()
}
