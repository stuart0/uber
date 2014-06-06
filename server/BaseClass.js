var log4js = require('log4js');
var bodyParser = require('body-parser')
var express = require('express');
var http = require('http');

var Database = require('./Database');

Function.prototype.extend = function(_super){
	
    // Create a new object with _super as the prototype, then initilize it
	function blankObject() {};
	blankObject.prototype	= _super.prototype;
	this.prototype = new blankObject;
    
    // When _super is called and no name provided, call the _super of the prototype 
    this.prototype._super = function(name) {
        var _orginalSuper = this._super;
        this._super	= _super.prototype._super;
        var result = (name ? _super.prototype[name] : _super).apply(this, Array.prototype.slice.call(arguments, 1));
        this._super	= _orginalSuper;
        
        return result;
    };
    
	this.prototype.constructor = this;

	return this;
};

//////////////////////////////////////////////////////////////////////
//
//
// BaseClass
//
//
//////////////////////////////////////////////////////////////////////
var BaseClass = module.exports = function BaseClass(config) { 
    var self = this;
    
    self.config = config;
    
    // Server name is required
    if (!self.serverName) {
        console.log("Error, self.serverName not set.  Set this in the derived class.  Exiting.");
        process.exit(1);
    }
    
    // Default instance number to 0 if not set
    self.instanceNumber = self.config.instanceNumber || 0;
    
    // Setup logging
    self.setupLogging();
    
    // Setup database
    self.database = new Database(self.config, self.logger, function(error) {
        if (error) {
            self.logger.error("BaseClass:: Database startup failed");
        }
        else {
            self.logger.debug("BaseClass:: Database startup successful");
            
            // Setup and start app server
            self.setupRestServer();
        }
    });
};  


///////////////////////////////////////
// 
// setupLogging
// 
///////////////////////////////////////
BaseClass.prototype.setupLogging = function() {
    var self = this;
    
    // Ensure logBasePath (if set) has a trailing /
    if(self.config.logBasePath && self.config.logBasePath.substr(-1) != '/') {
        self.config.logBasePath += '/';
    }
        
    log4js.configure({
        "appenders": [{
            "type": "file",
            "absolute": true,
            "filename": (self.config.logBasePath || '') + self.serverName + "_" + self.instanceNumber + ".log",
            "maxLogSize": self.config.maxLogFileSize || 20480,
            "backups": self.config.backups || 5,
            "category": self.serverName          
        }]
    });
    
    if(self.config.logToConsole) {
        log4js.replaceConsole();
        log4js.loadAppender('console');
        log4js.addAppender(log4js.appenders.console());
    }
    
    log4js.loadAppender('file');
    self.logger = log4js.getLogger(self.serverName);
    self.logger.debugFileStream = null;
    self.logger.setLevel(self.config.logLevel || 'DEBUG');
    
    self.logger.info("BaseClass:: starting server " + self.serverName + ":" + self.instanceNumber);  
    self.logger.debug("BaseClass:: server env: " + JSON.stringify(process.env));
};



///////////////////////////////////////
// 
// setupRestServer
// 
///////////////////////////////////////
BaseClass.prototype.setupRestServer = function() {
    var self = this;
    
    if(!self.config.serverPort) {
        self.logger.info("BaseClass:: no serverPort set... unable to start app server");
        return;
    }
    if(isNaN(self.config.serverPort) || isNaN(self.instanceNumber)) {
        self.logger.error("BaseClass:: server port number or instance number are not valid integers");
        return;
    }
    
    // Add instance number to server port to get the port number for this instance
    var myServerPort = parseInt(self.config.serverPort) + parseInt(self.instanceNumber);
    
    self.logger.info("BaseClass:: starting app server on port: " + myServerPort);
        
    self.restServer = express();
        
    // Setup access control headers
    self.restServer.use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Accept, DNT, Connection, Referer, Origin, Content-Type, Authorization, Content-Length, X-Requested-With');
        next();
    });
        
    // General options for express
    self.restServer.use(log4js.connectLogger(self.logger, { level: log4js.levels.DEBUG }));
    self.restServer.use(bodyParser.json());
    
    // Setup routes
    self.setupBaseRoutes();

    // Start server
    self.httpServer = http.createServer(self.restServer).listen(myServerPort);
};    


///////////////////////////////////////
// 
// setupBaseRoutes
// 
///////////////////////////////////////
BaseClass.prototype.setupBaseRoutes = function() {
    var self = this;
    
    self.logger.info("BaseClass:: setupBaseRoutes");

    // 'Is-alive' ping to check app code is still responding. More debug info could be added as desired
    self.restServer.get('/ping', function (req, res) {
        self.sendResponse(res, JSON.stringify({ status: "online" }), 200);
    });
    
    if (self.setupRoutes) {
        self.setupRoutes();
    }
};  


///////////////////////////////////////
// 
// sendResponse
// 
///////////////////////////////////////
BaseClass.prototype.sendResponse = function(res, result, code){
    var self = this;
    
    // Encapsulate response method to add custom headers etc
    try {
        self.logger.debug("BaseClass:: sending response: " + result);
        if (code) {
            res.send(code, result);
        }
        else {
            res.send(result);
        }
    }
    catch(err) {
        self.logger.debug("Error in sending response: " + err);
    }
};


///////////////////////////////////////
// 
// sendError
// 
///////////////////////////////////////
BaseClass.prototype.sendError = function(res, errorCode, errorString, errorMsg) {
    var self = this;
    self.sendResponse(res, JSON.stringify({
        error: {
            errorstring: errorString,
            detail: errorMsg
        }
    }), errorCode);
};


///////////////////////////////////////
// 
// updateObject
// 
///////////////////////////////////////
BaseClass.prototype.updateObject = function(originalObject, newData) {
    
    // Update the value of any properties in 'originalObject' that are present in
    // the 'newData'. Any properties in 'newData' not present in 'originalObject'
    // will be ignored. Only goes a single level deep.
    
    for(var key in originalObject) {
        if (originalObject.hasOwnProperty(key) && newData.hasOwnProperty(key)) {
            originalObject[key] = newData[key];
        }
    }
    
    return originalObject;
};

