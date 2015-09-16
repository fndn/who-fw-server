

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

start any endpoint with "/pub" to allow un-authenticated access

**/



var mongoose 	= require('mongoose');
var bodyParser 	= require('body-parser');
var moment 		= require('moment');
var chalk 		= require('chalk');
var util 		= require('util');
var fs 			= require('fs-extra');
var path 		= require('path');
var multiparty  = require('multiparty');
var sharp 		= require('sharp');
var mime 		= require('mime');

var db;
var app;
var models = [];
var dbname = '';
var uploader = null;

var use_strict_schema = false;

module.exports.init = function(_app, _databaseName){

	dbname = _databaseName;

	console.log( chalk.green("Starting Mirror") + " using "+ chalk.cyan(dbname) +", with "+ (use_strict_schema? chalk.bgGreen(chalk.black(" strict ")) :  chalk.bgRed(chalk.black(" loose "))) +" schemas");

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

		res.apiResponse = function(data, statusCode) {
			console.log( util.inspect(data, false,null,true), (statusCode || 200) );

			if( statusCode ) res.status(statusCode);
			
			res.json(data);
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

		/*
		NOTE: incompat with image uploader (requires multipart/form-data )
		
		// make sure put and post requests contain data
		if( req.method == 'PUT' || req.method == 'POST' ){
			if( Object.keys(req.body).length == 0 ){
				return res.apiError(req.method +' '+ req.url +' : no urlencoded data received (0)');
			}
		}
		*/

		next();
	});
}


module.exports.add = function(_name, fields){
	console.log( chalk.green("Mirror.add:", _name));

	var name = _name;

	models[name] = mongoose.model(name, mongoose.Schema({}, { strict: use_strict_schema }) );

	/*
	var doc = {};
	fields.forEach( function(field){
		doc[field] = ''
	})
	//console.log( chalk.grey('=> '), doc);

	// add _timestamp prop to the schema. Used for both created_at and updated_at
	doc['_timestamp'] = '';
	models[name] = mongoose.model(name, mongoose.Schema(doc, { strict: use_strict_schema }) );
	*/
	

	// Ensure cache-directories for this model exists (uploads dir is created in the /upload function below)
	var dir_imagecache 	= path.normalize( __dirname +'/../img-cache/'+ name);
	var dir_uploads 	= path.normalize( __dirname +'/../img-origs/'+ name);
	fs.mkdirsSync(dir_imagecache);

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
			if (err) return res.apiError(err.message);
			res.apiResponse({status:'ok', msg:item});
		});
	});


	// api: get image (with caching resizer)
	/// http://127.0.0.1:8090/pub/images/_999/i/600x400/back
	app.get('/pub/'+ name +'/:id/i/:size/:tag', function(req, res){ 
		
		var sizes = req.params.size.split('x').map(function(s){ return parseInt(s); }).filter( function(s){ return s <= 16383 });
		if( sizes.length < 2 ){
			res.apiResponse({status:'error', msg:'Illegal size provided (max size on any dimension: 16383px)'}, 500);
			return;
		}
		
		//console.log("get image for id:", req.params.id, "size:", req.params.size, sizes, "tag:", req.params.tag);

		var filename_chc = dir_imagecache +'/'+ req.params.id +'-'+ req.params.tag +'-'+ req.params.size +'.jpeg';
		var filename_org = dir_uploads    +'/'+ req.params.id +'-'+ req.params.tag +'.jpeg';
		console.log("filename cache:", filename_chc );
		console.log("filename orig: ", filename_org );

		//var filename_chc = './imagecache/'+ req.params.id +'-'+ req.params.tag +'-'+ req.params.size +'.jpeg';
		//var filename_org = './images-org/'+ req.params.id +'-'+ req.params.tag +'.jpeg';
		//console.log("filename_chc:", filename_chc, "filename_org:", filename_org );
		
		if( fs.existsSync(filename_chc) ){
			// image exist in cache
			console.log("⁙ img: serving cached");
			sendFile(res, filename_chc );				
		}else{
			
			if( fs.existsSync(filename_org) ){
				// create requested size
				sharp( filename_org )
					.resize(sizes[0], sizes[1])
					.toFile(filename_chc, function(err) {
						if( err ){
							// could not create the image
							res.apiResponse({status:'error', msg:'could not create the image'}, 404);
						}else{
							console.log("* img: serving resized");
							sendFile(res, filename_chc );
						}
					}
				);
			}else{
				// original does not exist
				res.apiResponse({status:'error', msg:'original does not exist'}, 404);
			}
		}
	});


	// helper for the get::image endpoint:
	function sendFile(res, filename){
		var options = {
			dotfiles: 'deny',
			headers: {
				'x-timestamp': Date.now(),
				'x-sent': true
			}
		};
		res.sendFile(filename, options, function (err) {
			if(err){
				console.log(err);
				res.status(err.status).end();
			}
		});
	}

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
		// if using strict: only keys already defined in schema will be saved
		// with loose, all fields will be saved.
		
		// make sure it does not already exist; prevent duplicates
		var nobj = req.body;

		console.log('req.body:', req.body);

		models[name].findOne({'name':nobj.name}).exec(function (err, items){
			
			if( items != null ){
				return res.apiResponse({status:'error', msg: "item '"+ nobj.name +"' already exists in table '"+ name +"'. Try an update instead?", data:items}, 500);
			}else{
				
				nobj._timestamp = new Date(); // created_at
				new models[name](nobj).save(function (err, item) {
					if (err) return res.apiError(err);
					res.apiResponse({status:'ok', msg:item});

					models[name].find(function(err, items){console.log("all "+ name, items) });
				});
			}

		});

		/*
		nobj._timestamp = new Date(); // created_at
		new models[name](nobj).save(function (err, item) {
			if (err) return res.apiError(err);
			res.apiResponse({status:'ok', msg:item});

			models[name].find(function(err, items){console.log("all "+ name, items) });
		});
		*/		
	});


	app.put('/'+ name +'/upload', function (req, res, next) {

		var form = new multiparty.Form();

		form.parse(req, function(err, fields, files) {
			console.log('processing file uploads');
			
			var okfiles = [];
			var id = fields.productId[0];

			// Create dir for the uploads (lazy, as most models will never have images)
			fs.mkdirsSync(dir_uploads);

			Object.keys(files).forEach( function(f){
				var o = files[f][0];
				var ext = mime.extension(o.headers['content-type']);
				console.log('ext:', ext);

				var filename = id +'-'+ o.originalFilename + '.'+ ext;
				fs.renameSync(o.path, dir_uploads +'/'+ filename);
				
				console.log('Saved Original to ', dir_uploads +'/'+ filename);
				okfiles.push(o.originalFilename);
			});

			res.apiResponse({status:'ok', msg:'upload_confirmed', id:id, files:okfiles});

		});

	});


	// api: update one by id AND diff
	app.post('/'+name +'/:id', function(req, res){

		if( req.params.id == 'diff' ){
			//Note: The diff function only works if there is a $name field on the objects
			var cdata = req.body.list;
			console.log("computing diff on table '"+ name); //, cdata );
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

				models[name].find(function(err, items){console.log("all "+ name, items) });
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

		//console.log('## items', items);

		var ret = {table:tablename, add:[], put:[], del:[]};
		var i, len, o, cr;


		// Diff against server to find items in the submitted list that
		// either needs to be ADDED to the server, or
		// REMOVED from the client.
		//
		// So: Check each item in the submitted list to see if it exists on server
		// if it does, check if is "removed" (on the server) and send it to the client as DELETE 
		// if not, add it
		len = list.length;
		for(var i=0; i<len; i++){
			var so = _findObjectByKeyValue(items, "name", list[i].name);
			if( so ){
				// record exist on server. Is it marked as Removed?
				if( so.removed == 'y' ){
					var o = _strip_fromObject( so );
					o._id = list[i]._id;
					//console.log(so.name +" is marked as removed!", o);
					ret.del.push(o);
				}
			}else{

				// record does not exist on the server
				var co = JSON.parse( JSON.stringify(list[i]));
				co._timestamp = new Date(); // created_at
				delete co._id;				
				var doc = new models[tablename](co);
				batch.push( doc );
			}
		};

		// Diff agains server to find items that is missing from the submitted list
		// if there is a name-match send the record to the client as a PUT
		// if there is no math, send it as ADD
		len = items.length;
		for(var i=0; i<len; i++){
			if( !_doesArrayContainObjectWithKeyValue(list, "name", items[i]._doc.name) ){
				var o = _strip_fromObject( items[i]._doc );
				//console.log( items[i]._doc.name + " DOES NOT exist on the client.", items[i]._doc, o );
				if( items[i]._doc.removed != 'y' ){
					//console.log('ADD to CLIENT', o);
					ret.add.push(o);
				}
			}else{
				//console.log( items[i]._doc.name + " EXISTS on the client.", items[i]._doc );

				var o = _strip_fromObject( items[i]._doc );

				if( cr = _compareObjects(o, list) ){

					if( items[i].removed != 'y' ){
						o._id = cr._id;
						//console.log("PUT to CLIENT", o);
						ret.put.push(o);
					}
				}

			}
		};

		//console.log('##--------- final ret:', ret);
		//console.log('##--------- final batch:', batch);
		

		/*
		// compute $add and $put
		len = items.length;
		for(var i=0; i<len; i++){
			if( !_doesArrayContainObjectWithKeyValue(list, "name", items[i]._doc.name) ){
				// record does not exist on the client
				var o = _strip_fromObject( items[i]._doc );

				if( items[i].removed != 'y' ){
					console.log("ADD", o);
					if( Object.keys(o).length > 0 ){
						ret.add.push(o);
					}
				}
			
			}else{
				// records match on "name", compare the other keys - treating server as truth

				var o = _strip_fromObject( items[i]._doc );

				if( cr = _compareObjects(o, list) ){

					if( items[i].removed != 'y' ){
						//console.log(" PUT:", o);
						o._id = cr._id;
						ret.put.push(o);
					}
				}
			}
		}
		*/

		/*
		// compute server add
		len = list.length;
		for(var i=0; i<len; i++){
			//console.log('#3 items[i].name:', items[i]._doc.name, "items[i]:", items[i]._doc );
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
					console.log("SERVER-ADD", co);	
				}
			}			
		}
		*/

		/*
		// compute $del (manually adding a $removed key to the server table)
		len = list.length;
		for(var i=0; i<len; i++){
			if( so = _findObjectByKeyValue(items, "name", list[i].name) ){
				// record exist on the server but not (or are different) on the client
				console.log('######### 1 DEL checking REMOVED: ', so.removed, so, list[i]);
				// only handle those that does not exist
				if( _findObjectByKeyValue(ret.put, "name", list[i].name)){
					// record has already been added to put (for update)
				}else{
					// only send if its not marked as removed on the server

					console.log('######### 2 DEL checking REMOVED: ', so.removed, so, list[i]);

					if( so.removed == 'y'){
						ret.del.push(list[i]);
					}
				}
			}else{
				// new
				//console.log('######### 3 DEL checking REMOVED: ', so.removed, so, list[i]);
				//var _o = _findObjectByKeyValue(items, "name", list[i].name);
				//console.log('   3 DEL checking REMOVED: ', _o, items );
				
			}		
		}
		*/	
	
		cb(null, ret);

		if( batch.length ){
			console.log( "Adding to database");
			models[tablename].create(batch, function (err, item) {
				if (err){
					console.log("Error: Could not create", tablename, batch);
				}else{
					console.log("Added record to", tablename, batch);
				}
			});
		}

	});
}

function _doesArrayContainObjectWithKeyValue( arr, key, val ){
	if( arr.length == 0 ) return;

	var use_doc = Object.keys(arr[0]).indexOf('_doc') > -1;
	
	for(var i=0; i<arr.length; i++){
		if( use_doc ){
			if( arr[i]._doc[key] == val ) return true;
		}else{
			if( arr[i][key] == val ) return true;
		}
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

	if( arr.length == 0) return false;

	var use_doc = Object.keys(arr[0]).indexOf('_doc') > -1;

	for(var i=0; i<arr.length; i++){
		if( use_doc ){
			if( arr[i]._doc[key] == val ) return arr[i]._doc;
		}else{
			if( arr[i][key] == val ) return arr[i];
		}

		//if( arr[i][key] == val ) return arr[i];
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

