

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

Append '.json|csv|simple' to all GET requests. JSON is the default.
Or maybe just .tsv ?
Example:
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.kv`
	`curl -X GET localhost:8080/kitten/55cb9c108a48f5cb5129d7fd.json`


## Notes

gte function:
- Using JS Date() as pr http://stackoverflow.com/questions/2943222/find-objects-between-two-dates-mongodb

diff function:
- The objects *must* have a "name" field

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
				//console.log( chalk.grey( util.inspect(data, false,null)) );
				console.log( util.inspect(data, false,null,true) );
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

	// api: update one by id AND diff
	app.post('/'+name +'/:id', function(req, res){

		if( req.params.id == 'diff' ){
			//Note: The diff function only works if there is a $name field on the objects
			var cdata = req.body.list;
			console.log("computing diff on table '"+ name +"'\n", cdata );
			_compute_dif(name, cdata, function(err, result){
				if (err) return res.apiError(err);
				res.apiResponse({status:'ok', msg:result});
			});

		}else{
			console.log("update ", req.params.id );

			/*
			models[name].findById(req.params.id).exec(function(err, item) {
				if (err) return res.apiError(err);
				//res.apiResponse({status:'ok', msg:item});
				item._timestamp = new Date(); // updated_at
				item.
			});
			
			*/
			/*
			req.body._timestamp = new Date(); // updated_at
			models[name].findOneAndUpdate(req.params.id, req.body, {new:true, upsert:true}, function (err, item) {
				if (err) return res.apiError(err);
				res.apiResponse({status:'ok', msg:item});
			});
			*/
			req.body._timestamp = new Date(); // updated_at
			models[name].update({_id:req.params.id}, req.body, {new:true, upsert:false}, function (err, item) {
				if (err) return res.apiError(err.message);
				res.apiResponse({status:'ok', msg:item});
			});
		}
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

// Utilities

function _compute_dif(tablename, list, cb){

	var batch = []; // will hold records to create on server
	
	models[tablename].find( function(err, items) {

		var ret = {table:tablename, add:[], put:[], del:[]};
		var i, len, o, cr;
		// compute $add and $put
		len = items.length;
		for(var i=0; i<len; i++){
			if( !_doesArrayContainObjectWithKeyValue(list, "name", items[i].name) ){
				// record does not exist on the client
				var o = _strip_fromObject( items[i]._doc );
				if( items[i].removed != 'Y' ){
					//console.log("ADD", o);
					if( Object.keys(o).length > 0 ){
						ret.add.push(o);
					}
				}
			
			}else{
				// records match on "name", compare the other keys - treating server as truth

				var o = _strip_fromObject( items[i]._doc );

				if( cr = _compareObjects(o, list) ){

					//console.log("");
					//console.log("Value Diff");
					//console.log(" server-record:", o);
					//console.log(" client-record:", cr);

					if( items[i].removed != 'Y' ){
						//console.log(" PUT:", o);
						o._id = cr._id;
						ret.put.push(o);
					}
				}
			}
		}
		// compute server add
		len = list.length;
		for(var i=0; i<len; i++){
			if( !_doesArrayContainObjectWithKeyValue(items, "name", list[i].name) ){
				// record does not exist on the server
				var co = list[i];
				delete co._id;
				
				//Check for Empty keys
				var _tmp = [];
				Object.keys(co).forEach( function(k){
					_tmp.push( co[k] );
				});
				if( _tmp.join('') != '' ){
					co._timestamp = new Date(); // created_at
					var doc = new models[tablename](co);
					batch.push( doc );
					console.log("SERVER-ADD", co, doc);	
				}
			}			
		}
		// compute $del (manually adding a $removed key to the server table)
		len = list.length;
		for(var i=0; i<len; i++){
			if( so = _findObjectByKeyValue(items, "name", list[i].name) ){
				// record exist on the server but not (or are different) on the client
				// only handle those that does not exist
				if( _findObjectByKeyValue(ret.put, "name", list[i].name)){
					// record has already been added to put (for update)
				}else{
					// only send if its not marked as removed on the server
					if( so.removed == 'Y'){
						ret.del.push(list[i]);
					}
				}
			}			
		}		
	
		cb(null, ret);

		if( batch.length ){
			console.log( "Adding to database");
			models[tablename].create(batch, function (err, item) {
				if (err) console.log("Error: Could not create", tablename, batch);
				console.log("Added batch to", tablename, batch);
			});
		}

	});
}

function _doesArrayContainObjectWithKeyValue( arr, key, val ){
	for(var i=0; i<arr.length; i++){
		//console.log("comparing ", arr[i], key, val, ( arr[i][key] == val ) );
		if( arr[i][key] == val ) return true;
	}
	return false;
}

function _compareObjects(o1, arr){
	var o1k = Object.keys(o1);
	var match = null;
	// find $name match
	for(var i=0; i<arr.length; i++){
		if( arr[i].name == o1.name ){
			var o2 = arr[i];
			o1k.forEach( function(k){
				//console.log("comparing on key", k, o1[k], o2[k], ( o1[k] == o2[k] ) );
				if( o1[k] != o2[k] ) match = o2; //matching = false;
			});
		}
	}	
	//return matching;
	return match;
}

function _findObjectByKeyValue( arr, key, val ){
	for(var i=0; i<arr.length; i++){
		if( arr[i][key] == val ) return arr[i];
	}
	return false;
}


function _strip_fromObject(obj){
	var ret = {};
	for(var k in obj){
		//console.log("k", k);
		if( k.substr(0,1) != '_' && k != 'removed'){
			ret[k] = obj[k];
		}
	}
	//console.log("k klean:", ret);
	return ret;
}

