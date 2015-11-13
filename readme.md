(for now, this repo is just a clone of my Mirror project. Check back later)



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


## tips

mongo <dbname> --eval "db.dropDatabase()"

mongoimport -d FWA_PILOT_151106_2 -c register --file register.json


---
Port Scan has started…

Port Scanning host: 46.101.177.65

	 Open TCP Port: 	22     		ssh
	 Open TCP Port: 	80     		http
	 Open TCP Port: 	443    		https
	 Open TCP Port: 	8071
	 Open TCP Port: 	8081   		sunproxyadmin
	 Open TCP Port: 	8091
	 Open TCP Port: 	9100   		hp-pdl-datastr
Port Scan has completed…

