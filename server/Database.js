var mysql = require('mysql');

// Restore the scope of this object on event calls
var scope = function (f, scope) {
    return function () {
        return f.apply(scope, arguments);
    };
};


//////////////////////////////////////////////////////////////////////
//
//
// Database
//
//
//////////////////////////////////////////////////////////////////////
var Database = module.exports = function Database(config, logger, callback) { 
    var self = this;
    
    self.logger = logger;
    
    self.logger.info("Database:: initializing database module");
    
    if(config.dbHost && config.dbUser && config.dbPass && config.dbName) {
        self.sqlConnectionSettings = {
            host     : config.dbHost,
            user     : config.dbUser,
            password : config.dbPass,
            database : config.dbName
        };
    
        self.connectToDB(callback);
    }
    else {
        self.logger.error("Database:: missing DB params in config");
        callback(true);
    }
};



///////////////////////////////////////
//
// connectToDB
//
///////////////////////////////////////
Database.prototype.connectToDB = function(callback) {
	var self = this;
    var callback = callback || function() {};
	
	self.logger.debug("Database:: connecting to mySQL Database");
	
	self.mySQLConnection = mysql.createConnection(self.sqlConnectionSettings);
	
    // Define error handlers
    self.mySQLConnection.on('error', scope(self.handleSQLDisconnect, self));
    self.mySQLConnection.on('close', scope(self.handleSQLDisconnect, self));
    
    self.mySQLConnection.connect(function(err) {
        if (err) {
            self.logger.debug("Database:: mySQL connection error: " + err);
            callback(true);
        }
        else {
            self.logger.debug("Database:: mySQL connected");
            callback(false);
        }
    });
};


///////////////////////////////////////
// 
// handleDBDisconnect
// 
///////////////////////////////////////
Database.prototype.handleDBDisconnect = function(err) {
	var self = this;
	
    if (!err.fatal) { 
        return; 
    }
	
	if(err.code==='PROTOCOL_CONNECTION_LOST') {
		self.logger.debug('Database:: restoring lost mySQL connection: ' + err.stack);
		self.connectToDB();
	}
    
	else if (err.code === 'ECONNREFUSED') {
		self.logger.debug('Database:: database connection refused, waiting 3 seconds before retry...' + err.stack);
		setTimeout(function() { 
			self.connectToDB(); 
		},3000);
	}
    
	else {
		throw err;
	}	
};


///////////////////////////////////////
// 
// insertUpdateTable
// 
///////////////////////////////////////
Database.prototype.insertUpdateTable = function(table, data, doNotUpdateList, callback){
    var self = this;
    var queryStr = "INSERT INTO " + table + " ";
    var updateText = " ON DUPLICATE KEY UPDATE ";
    var insertListStr = "";
    var insertValueStr = "";
    var updateStr = "";

    for (var key in data) {
        if (Object.hasOwnProperty.call(data, key)) {
            var dataValue = mysql.escape(data[key]);
            
            insertListStr += (insertListStr === "") ? " " : ", ";
            insertListStr += key;
            
            insertValueStr += (insertValueStr === "") ? " " : ", ";
            insertValueStr += dataValue;
            
            // if key is in updateIgnore list then skip it.
            if (doNotUpdateList.indexOf(key) === -1) {
                updateStr += (updateStr === "") ? " " : ", ";
                updateStr += key + "=" + dataValue;
            }
        }
    }
    
    queryStr = queryStr + "(" + insertListStr + ") VALUES (" + insertValueStr + ")" + updateText + updateStr;
    
    self.logger.debug("queryStr: " + queryStr);
    self.mySQLConnection.query(queryStr, function(err, result) {
        if (err) {
            self.logger.debug("INSERT/UPADTE " + table + " failed: " + err);
        }
        self.logger.debug("Result: " + JSON.stringify(result));
        callback(err, result);
    });
};



///////////////////////////////////////
// 
// insertUpdateFavorite
// 
///////////////////////////////////////
Database.prototype.insertUpdateFavorite = function(userId, favorite, callback){
    favorite.uuid = userId;
    this.insertUpdateTable("favorites", favorite, ["id", "uuid", "latitude", "longitude", "createDate"], function(err, result) {
        delete favorite.uuid;
        callback(err,result);
    });
};


///////////////////////////////////////
// 
// getFavorites
// 
///////////////////////////////////////
Database.prototype.getFavorites = function(uuid, favId, callback) {
	var self = this;
	
    var queryStr = "SELECT id, name, latitude, longitude, streetNumber, streetName, city, state, zip, country, createDate " +
                    "FROM favorites WHERE uuid = " + mysql.escape(uuid);
                    
    if(favId) {
        queryStr += " AND id = " + mysql.escape(favId);
    }
    
    self.logger.debug("Database:: query: " + queryStr);
    self.mySQLConnection.query(queryStr, function(err, rows) {
        if (err) {
            self.logger.debug("Database:: cannot select favorites for user: " + uuid + " -- " + err);
            callback(true);
        }
        else {
            callback(false, rows);
        }
    });
};

///////////////////////////////////////
// 
// getUserFavorites
// 
///////////////////////////////////////
Database.prototype.getUserFavorites = function(uuid, callback) {
    this.getFavorites(uuid, null, callback);
};

///////////////////////////////////////
// 
// getUserFavoriteById
// 
///////////////////////////////////////
Database.prototype.getUserFavoriteById = function(uuid, favId, callback) {
    this.getFavorites(uuid, favId, function(err, rows) {
        if(err) {
            callback(true);
        }
        else if(rows.length === 0) {
            callback(false, false);
        }
        else {
            callback(false, rows[0]);
        }
    });
};


///////////////////////////////////////
// 
// deleteUserFavoriteById
// 
///////////////////////////////////////
Database.prototype.deleteUserFavoriteById = function(uuid, favId, callback) {
	var self = this;
	
    var queryStr = "DELETE FROM favorites WHERE uuid = " + mysql.escape(uuid) + " AND id = " + mysql.escape(favId);
    
    self.logger.debug("Database:: query: " + queryStr);
    self.mySQLConnection.query(queryStr, function(err, result) {
        if (err) {
            self.logger.debug("Database:: cannot delete favorite for user: " + uuid + " -- " + err);
            callback(true);
        }
        else {
            callback(false, result);
        }
    });
};

///////////////////////////////////////
// 
// getUserByUsername
// 
///////////////////////////////////////
Database.prototype.getUserByEmail = function(email, callback) {
	var self = this;
	
    var queryStr = "SELECT * FROM users WHERE email = " + mysql.escape(email);
    
    self.logger.debug("Database:: query: " + queryStr);
    self.mySQLConnection.query(queryStr, function(err, rows) {
        if (err || rows.length == 0) {
            self.logger.debug("Database:: cannot select user: " + email + " -- " + (err || "not found"));
            callback(true);
        }
        else {
            callback(false, rows[0]);
        }
    });
};