# Mirror

Simple API oriented MonogoDB-based data store


Call `mirror.init(expressApp, 'databaseName' );` to connect Mirror to Mongo. 

Call `mirror.add(collectionName, [fieldNames]);` to create 

- a Mongoose Schema  
- a MongoDB Collection
- and expose GET, PUT, POST and DELETE actions 


### ROADMAP

- Add URL mountpoint for routes
- Add utility functions ala `GET /collection/gte/{date}`, ignore if-exists, consolidate, next-id etc.
- Add Auth middleware
- Add Image store (and extract GPS data if stamped on images)
