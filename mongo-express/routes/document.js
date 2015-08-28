var bson = require('../bson');

var routes = function(config) {
  var exp = {};

  exp.viewDocument = function(req, res, next) {
    var ctx = {
      title: 'Viewing Document: ' + req.document._id,
      editorTheme: config.options.editorTheme,
      docString: bson.toString(req.document)
    };

    res.render('document', ctx);
  };




  exp.addDocument = function(req, res, next) {
    var doc = req.body.document;

    if (doc == undefined || doc.length == 0) {
      req.session.error = "You forgot to enter a document!";
      return res.redirect('back');
    }

    var docBSON;

    try {
      docBSON = bson.toBSON(doc);
    } catch (err) {
      req.session.error = "That document is not valid!";
      console.error(err);
      return res.redirect('back');
    }

    req.collection.insert(docBSON, {safe: true}, function(err, result) {
      if (err) {
        req.session.error = "Something went wrong: " + err;
        console.error(err);
        return res.redirect('back');
      }

      req.session.success = "Document added!";
      res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
    });
  };


  // js
 exp.removeDocument = function(req, res, next) {
 
    
    var doc = req.document;

    console.log('Marking doc as removed:', req.document._id);

    if (doc == undefined || doc.length == 0) {
      req.session.error = "Invalid document!";
      return res.redirect('back');
    }

    doc['removed'] = 'y';
    var crits = {'_id': req.document._id };

    //console.log('crits', crits);
    //console.log('doc', doc);

    req.collection.update(crits, doc, {safe: true}, function(err, result) {
      if (err) {
        //document was not saved
        req.session.error = "Something went wrong: " + err;
        console.error(err);
        return res.redirect('back');
      }

      req.session.success = "Document updated!";
      res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
    });
  };

  exp.updateDocument = function(req, res, next) {
    var doc = req.body.document;

    if (doc == undefined || doc.length == 0) {
      req.session.error = "You forgot to enter a document!";
      return res.redirect('back');
    }

    var docBSON;
    try {
      docBSON = bson.toBSON(doc);
    } catch (err) {
      req.session.error = "That document is not valid!";
      console.error(err);
      return res.redirect('back');
    }

    docBSON._id = req.document._id;

    req.collection.update(req.document, docBSON, {safe: true}, function(err, result) {
      if (err) {
        //document was not saved
        req.session.error = "Something went wrong: " + err;
        console.error(err);
        return res.redirect('back');
      }

      req.session.success = "Document updated!";
      res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
    });
  };


  exp.deleteDocument = function(req, res, next) {
    req.collection.remove(req.document, {safe: true}, function(err, result) {
      if (err) {
        req.session.error = "Something went wrong! " + err;
        console.error(err);
        return res.redirect('back');
      }

      req.session.success = "Document deleted!";
      res.redirect(res.locals.baseHref + 'db/' + req.dbName + '/' + req.collectionName);
    });
  };

  return exp;
};

module.exports = routes;
