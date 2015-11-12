

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
var handlebars 	= require('handlebars');

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

	// link $tag$name $record-id
	app.get('/'+ name +'/link/:id/i/:size/:tag', function(req, res){ 

	});

	var tpl_list = null;

	app.get('/pub/'+ name +'/list', function(req, res){
		
		name = 'register';
		var re = /(^img_)(.+)(_url$)/g; 

		if( !tpl_list ){
			tpl_list = handlebars.compile( fs.readFileSync('./mirror/tpl/tpl.list.mst').toString() );
		}

		models[name].find( function(err, items) {
			items = items.map( function(rec){ return rec._doc.doc; });

			//console.log('items', items); // array of objects
			//rec.img_back_url = rec.img_back_url.replace('products', 'products/img');
			//rec.img_back_url = rec.img_back_url.replace('jpg', 'jpeg');
			// https://whofw.fndn.dk/pub/products/img/VyY08H8lg-back-2040x6136.jpeg
			// https://whofw.fndn.dk/pub/products/img/Ek8ClsVxg-back-1136x640.jpg

			console.log('items.length', items.length);

			if( items.length === 0){
				items = [{}];
			}else{

				for(var i=0, len = items.length; i<len; i++){
					var item = items[i];
					var keys = Object.keys(item);
					//console.log('item:', item, 'keys:', keys );
					for(var j=0, len2 = keys.length; j<len2; j++){
						var key = keys[j];
						//console.log('testing key:', key );
						if( re.exec(key) !== null ){
							console.log('# matched key:', key, 'val:', item[key] );

							items[i][key] = items[i][key].replace('products', 'products/img');
							items[i][key] = items[i][key].replace('1136x640.jpg', '640x1136.jpeg');
							items[i][key] = '<a target="_blank" href="'+ items[i][key] +'">'+ (items[i][key].split('-')[2]) +'</a>';
							console.log('> result:', items[i][key] );
						}
					}
				}
			}

			var html = tpl_list({
				title: 	name,
				headers: Object.keys(items[0]),
				records: items
			});

			res.setHeader('content-type', 'text/html');
			res.send( html );
		});
	});

	
	app.get('/pub/'+ name +'/csv', function(req, res){ 

		name = 'register';

		models[name].find( function(err, items) {
			items = items.map( function(rec){ return rec._doc.doc; });

			if( !items.length ){
				res.json({"error":"no data"});
				return;
			}
			
			var doc = '';
			doc += Object.keys(items[0]).join(';');
			doc += "\n";
			for(var i in items){
				var row = items[i];
				var vals = [];
				for(var j in row){
					vals.push( row[j] );
				}
				doc += vals.join(';');
				doc += "\n";
			}
			res.setHeader('content-type', 'text/csv');
			res.send( doc );
		});
	});

	app.get('/pub/'+ name +'/csv2', function(req, res){ 

		name = 'register';

		var headers = ["_id", "adr_elvacc", "adr_posacc", "adr_elv", "adr_lng", "adr_lat", "prc_currency", "prc_normal", "prc_current", "pro_priceReduction", "pro_otherTextOnPackage", "pro_multiBuyDiscount", "pro_freeGiveAways", "pkg_hclaims", "pkg_cclaims", "pkg_mother", "pkg_children", "pkg_cartoons", "usr_affiliation", "usr_reporter", "prd_brand", "prd_type", "prd_agegrp", "prd_name", "adr_storeType", "adr_storeBrand", "adr_incomeType", "adr_countryCode", "adr_country", "adr_neighbourhood", "adr_street", "adr_city", "time", "hash", "name", "img_right_url", "img_right", "img_left_url", "img_left", "img_back_url", "img_back", "img_front_url", "img_front", "nut_serv_sodium", "nut_serv_salt", "nut_serv_protein", "nut_serv_carbohydrateOfWhichLactose", "nut_serv_carbohydrateOfWhichSugars", "nut_serv_carbohydrate", "nut_serv_fatOfWhichTrans", "nut_serv_fatOfWhichSaturates", "nut_serv_fat", "nut_serv_energyKcal", "nut_serv_energyKj", "nut_serv_servingSize", "nut_100g_sodium", "nut_100g_salt", "nut_100g_protein", "nut_100g_carbohydrateOfWhichLactose", "nut_100g_carbohydrateOfWhichSugars", "nut_100g_carbohydrate", "nut_100g_fatOfWhichTrans", "nut_100g_fatOfWhichSaturates", "nut_100g_fat", "nut_100g_energyKcal", "nut_100g_energyKj"];

		models[name].find( function(err, items) {
			items = items.map( function(rec){ return rec._doc.doc; });

			if( !items.length ){
				res.json({"error":"no data"});
				return;
			}
			
			var doc = headers.join(';') +"\n";

			//console.log("#1 doc", doc);

			for(var i in items){
				var row = items[i];

				//console.log( i +" row", row);

				var vals = [];	
				for(var j in headers){
					var h = headers[j];
					
					var keys = Object.keys(row);
					if( keys.indexOf(h) > -1 ){
						vals.push(row[ keys[h] ]);
					}else{
						vals.push('-');
					}					
				}
				doc += vals.join(';');
				doc += "\n";
			}
			res.setHeader('content-type', 'text/csv');
			res.send( doc );
		});
	});


	app.get('/pub/'+ name +'/img/:imagename', function(req, res){ 
		var imgname = req.params.imagename.split(".")[0];
		console.log('imgname', imgname);
		var parts = imgname.split(/-/g);
		console.log('parts', parts);
		if( parts.length < 3 ){
			res.apiResponse({status:'error', msg:'Illegal imagename provided (convention: id-tag-size)'}, 500);
			return;
		}
		_getImage( parts[0], parts[1], parts[2], res);
	});

	/*
	// api: get image (with caching resizer) NJheV3mC/front/300x300
	app.get('/pub/'+ name +'/:id/image/:tag/:size', function(req, res){
		_getImage( req.params.id, req.params.tag, req.params.size, res);
	});
	*/

	function _getImage(id, tag, size, res){
		var sizes = size.split('x').map(function(s){ return parseInt(s); }).filter( function(s){ return s <= 16383 });
		if( sizes.length < 2 ){
			res.apiResponse({status:'error', msg:'Illegal size provided (max size on any dimension: 16383px)'}, 500);
			return;
		}
		
		//console.log("get image for id:", req.params.id, "size:", req.params.size, sizes, "tag:", req.params.tag);

		var filename_chc = dir_imagecache +'/'+ id +'-'+ tag +'-'+ size +'.jpeg';
		var filename_org = dir_uploads    +'/'+ id +'-'+ tag +'.jpeg';
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
	}

	// helper for the _getImage endpoint:
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
	app.get('/'+ name +'/gte/:date', function(req, res){
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

		//models[name].findOne({'hash':nobj.hash}).exec(function (err, items){
		models[name].findOne({'name':nobj.name}).exec(function (err, items){	
			
			if( items != null ){
				return res.apiResponse({status:'error', type:'duplicate', msg: "item "+ name +"/"+ nobj.name +" already exists in table "+ name +". Try an update instead?", data:items}, 500);
			}else{
				
				nobj._timestamp = new Date(); // created_at
				new models[name](nobj).save(function (err, item) {
					if (err) return res.apiError(err);
					res.apiResponse({status:'ok', msg:item});

					models[name].find(function(err, items){console.log("all "+ name, items) });
				});
			}

		});	
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
				
				console.log( chalk.blue('Saved Original to ', dir_uploads +'/'+ filename) );
				okfiles.push(o.originalFilename);
			});

			res.apiResponse({status:'ok', msg:'upload_confirmed', id:id, files:okfiles});

		});

	});


	// api: update one by id AND diff
	app.post('/'+ name +'/:id', function(req, res){

		if( req.params.id == 'diff' ){
			//Note: The diff function only works if there is a $name field on the objects
			var cdata = req.body.list;
			console.log("computing diff on table '"+ name +"'");//, cdata );
			_compute_dif(name, cdata, function(err, result){
				if (err) return res.apiError(err);
				res.apiResponse({status:'ok', msg:result});
			});

		}else{
			console.log("update ", req.params.id );

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

		console.log('\n## Client items', list);
		console.log('\n## Server items', items);

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
			var so = _findObjectByKeyValue(items, "hash", list[i].hash);
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
			if( !_doesArrayContainObjectWithKeyValue(list, "hash", items[i]._doc.hash) ){
				var o = _strip_fromObject( items[i]._doc );
				console.log( items[i]._doc.name + " DOES NOT exist on the client.", items[i]._doc, o );
				if( items[i]._doc.removed != 'y' ){
					console.log('ADD to CLIENT', o);
					ret.add.push(o);
				}
			}else{
				//console.log( items[i]._doc.name + " EXISTS on the client.", items[i]._doc );

				var o = _strip_fromObject( items[i]._doc );

				if( items[i].removed != 'y' ){
					
					//console.log(' COMPARING ', o, list, "result:", _compareObjects(o, list)  );
					console.log('\n');
					var cr = _compareObjects(o, list);
					console.log(" COMPARING.. result:", cr);
					
					if( ! cr ){
						console.log("PUT to CLIENT", o);
						ret.put.push(o);
					}
				}

			}
		};

		//console.log('##--------- final ret:', ret);
		//console.log('##--------- final batch:', batch);
	
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
	for(var i=0; i<arr.length; i++){
		if( arr[i].hash == o1.hash ){
			var o2 = arr[i];
			for(var j=0; j<o1k.length; j++){
				var k = o1k[j];
				console.log("comparing on key", k, o1[k], o2[k], " => ", ( o1[k] == o2[k] ) );
				if( o1[k] != o2[k] ) return false; // there is a difference
			}
		}
	}	
	return true;
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

