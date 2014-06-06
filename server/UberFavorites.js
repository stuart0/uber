var fs = require('fs');
var passwordHash = require('password-hash');
var geocoder = require('node-geocoder');

var BaseClass = require('./BaseClass');


//////////////////////////////////////////////////////////////////////
//
//
// UberFavorites
//
//
//////////////////////////////////////////////////////////////////////
var UberFavorites = module.exports = function UberFavorites(config) { 
    var self = this;
    
    self.serverName = "uberFavorites";
    self.myGeocoder = geocoder.getGeocoder('google', 'http');
    
    // DEMO ONLY - Object to store all the auth sessions
    self.authSessions = {};
    
    // Set any config defaults
    config.maxFavorites = config.maxFavorites || 5;
        
    self._super(null, config);
}.extend(BaseClass);



///////////////////////////////////////
// 
// setupRoutes
// 
///////////////////////////////////////
UberFavorites.prototype.setupRoutes = function() {
    var self = this;
    
    // LOGIN  / AUTH (for demo purposes only)
    self.restServer.post('/login', function (req, res) {
        self.login(res, req.body);
    });
    self.restServer.all('/users/:userid/*', function(req, res, next) {
        self.authenticateRequest(res, req.params.userid, req.query.token, next);
    });
    
    // FAVORITES
    self.restServer.post('/users/:userid/favorites', function (req, res) {
        self.addFavorite(res, req.params.userid, req.body);
    });
    
    self.restServer.get('/users/:userid/favorites', function (req, res) {
        self.getFavorites(res,req.params.userid);
    });
    
    self.restServer.get('/users/:userid/favorites/:favId', function (req, res) {
        self.getFavorite(res,req.params.userid, req.params.favId);
    });
    
    self.restServer.put('/users/:userid/favorites/:favId', function (req, res) {
        self.updateFavorite(res,req.params.userid, req.params.favId, req.body);
    });
    
    self.restServer.delete('/users/:userid/favorites/:favId', function (req, res) {
        self.deleteFavorite(res,req.params.userid, req.params.favId);
    });
    
};



///////////////////////////////////////
// 
// addFavorite
// 
///////////////////////////////////////
UberFavorites.prototype.addFavorite = function(res, userId, requestData) {
    var self = this;
    
    var addNewFavorite = function(geocoderResult) {
        var favoriteName = requestData.name;
        
        // If no name send in request, attempt to build on from geocoder result
        if(!favoriteName) {
            if(geocoderResult.streetName) {
                favoriteName =  geocoderResult.streetName;
                if(geocoderResult.streetNumber) {
                    favoriteName =  geocoderResult.streetNumber + ' ' + favoriteName;
                }
            }
        }
        
        // Build location object and add to database - any missing values will just be null
        var newFavorite = {
            name: favoriteName,
            latitude: geocoderResult.latitude,
            longitude: geocoderResult.longitude,
            streetNumber: geocoderResult.streetNumber,
            streetName: geocoderResult.streetName,
            city: geocoderResult.city,
            state: geocoderResult.state,
            zip: geocoderResult.zipcode,
            country: geocoderResult.country
        };
        
        self.database.insertUpdateFavorite(userId, newFavorite, function(err, result) {
            if(err) {
                // Something bad happened, return 500 error
                self.logger.error("error adding favorite to database");
                self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
            }
            else {
                // Return 201 and new favorite object to user
                self.logger.debug("successfully added favorite to DB");
                newFavorite.id = result.insertId;
                res.header('Location','/users/' + userId + '/favorites/' + result.insertId);
                self.sendResponse(res, JSON.stringify(newFavorite), 201);
            }
        });    

    }
    
    // Get users existing favorites
    self.database.getUserFavorites(userId, function(err, favorites) {
        if(err) {
            // Something bad happened, return 500 error
            self.logger.error("error getting user favorites from database");
            self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
        }
        else if(favorites.length >= self.config.maxFavorites) {
            self.logger.debug("max number of favorites reached, cannot add anymore for this user");
            self.sendError(res, 422, "MAX_FAVORITES_REACHED", "The maximum number of favorites have been added for this user");
        }
        else {
            // If name is set, check it doesn't conflict with existing favorite
            if(requestData.name) {
                for(var i=0; i < favorites.length; i++) {
                    if(favorite[i].name === requestData.name) {
                        self.logger.debug("name in request matches existing favorite name");
                        self.sendError(res, 422, "NAME_ALREADY_EXISTS", "Favorite already exists with this name");
                        return;
                    }
                }
            }
            
            // Lookup address by latitude / longitude
            if(requestData.latitude && requestData.longitude) {
                self.logger.info("add favorite request based on latitude and longitude: " + JSON.stringify(requestData));
                if(isNaN(requestData.latitude) || isNaN(requestData.longitude)) {
                    self.sendError(res, 422, "LAT_LONG_INVALID", "Latitude and/or longitude valids invalid");
                }
                else {
                    // Geocoder lib returns an array of results, the first being the most accurate
                    self.myGeocoder.reverse(requestData.latitude, requestData.longitude, function(err, result) {
                        self.logger.debug("response from geocoder request: " + err + " -- " + JSON.stringify(result));
                        
                        if(err || !result || !result[0]) {
                            // If lookup failed, just add favorite based on latitude / longitide
                            addNewFavorite({latitude: requestData.latitude, longitude: requestData.longitude});
                        }
                        else {
                            // If lookup worked, edit the latitude / longitide to what the user originally wanted
                            result[0].latitude = requestData.latitude;
                            result[0].longitude = requestData.longitude;
                            addNewFavorite(result[0]);
                        }
                    });
                }
            }
            
            // Lookup latitude / longitude from address
            else if(requestData.address) {
                self.logger.info("add favorite request based on address " + JSON.stringify(requestData));
                
                // Geocoder lib returns an array of results, the first being the most accurate
                self.myGeocoder.geocode(requestData.address, function(err, result) {
                    self.logger.debug("response from geocoder request: " + err + " -- " + JSON.stringify(result));
                    
                    if(err || !result || !result[0] || !result[0].latitude || !result[0].longitude) {
                        // If lookup failed, we have nothing to go on to return an error
                        self.sendError(res, 422, "ADDRESS_INVALID", "Unable to validate location");
                    }
                    else {
                        // If lookup worked, add the new favorite based on the result returned
                        addNewFavorite(result[0]);
                    }
                });
            }
            
            // Request with no location parameters
            else {
                self.logger.info("add favorite request with no valid parameters - returnig error");
                self.sendError(res, 422, "INVALID_PARAMS", "No valid location parameters in request");
            }
        }
    });
}


///////////////////////////////////////
// 
// getFavorites
// 
///////////////////////////////////////
UberFavorites.prototype.getFavorites = function(res, userId) {
    var self = this;
    
    self.logger.info("getting favorites for user: " + userId);
    
    // Get users existing favorites
    self.database.getUserFavorites(userId, function(err, favorites) {
        if(err || !favorites) {
            // Something bad happened, return 500 error
            self.logger.error("error getting user favorites from database");
            self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
        }
        else {
            self.logger.debug("returning " + favorites.length + " favorites to user");
            self.sendResponse(res, JSON.stringify(favorites), 200);
        }
    });
};


///////////////////////////////////////
// 
// getFavorite
// 
///////////////////////////////////////
UberFavorites.prototype.getFavorite = function(res, userId, favId) {
    var self = this;
    
    self.logger.info("getting favorite id " + favId + " for user: " + userId);
    
    // Get users existing favorite by id
    self.database.getUserFavoriteById(userId, favId, function(err, favorite) {
        if(err) {
            // Something bad happened, return 500 error
            self.logger.error("error getting user favorites from database");
            self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
        }
        else if(!favorite) {
            self.logger.debug("favorite not found");
            self.sendError(res, 404, "NOT_FOUND", "Favorite not found");
        }
        else {
            self.logger.debug("returning favorite to user");
            self.sendResponse(res, JSON.stringify(favorite), 200);
        }
    });
};


///////////////////////////////////////
// 
// updateFavorite
// 
///////////////////////////////////////
UberFavorites.prototype.updateFavorite = function(res, userId, favId, requestData) {
    var self = this;
    
    self.logger.info("updating favorite id " + favId + " for user: " + userId);
    
    // Don't allow latitude, longitude or id to be updated
    if(requestData.id || requestData.latitude || requestData.longitude) {
        self.logger.debug("invalid params in request " + JSON.stringify(requestData));
        self.sendError(res, 422, "INVALID_UPDATE_PARAMS", "Request contains parameters which cannot be updated");
    }
    else {
        // Get users existing favorite by id
        self.database.getUserFavoriteById(userId, favId, function(err, favorite) {
            if(err) {
                self.logger.error("error getting user favorites from database");
                self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
            }
            else if(!favorite) {
                self.logger.debug("favorite not found");
                self.sendError(res, 404, "NOT_FOUND", "Favorite not found");
            }
            else {
                // Update favorite with params from request
                var updatedFavorite = self.updateObject(favorite, requestData);
                self.database.insertUpdateFavorite(userId, updatedFavorite, function(err) {
                   if(err) {
                       self.logger.error("error updating favorite in database");
                       self.sendError(res, 500, "INTERNAL_ERROR", "An internal server error took place while processing your request");
                   }
                   else {
                       self.sendResponse(res, JSON.stringify(updatedFavorite), 200);
                   } 
                });
            }
        });
    }
};


///////////////////////////////////////
// 
// deleteFavorite
// 
///////////////////////////////////////
UberFavorites.prototype.deleteFavorite = function(res, userId, favId) {
    var self = this;
    
    self.logger.info("deleting favorite id " + favId + " for user: " + userId);
    
    // Delete favorite based on userid and favId
    self.database.deleteUserFavoriteById(userId, favId, function(err, result) {
        if(err) {
            self.logger.error("error deleting user favorite from database");
            self.sendError(res, 500, "INTERNAL_ERROR", "An internal server took place while processing your request");
        }
        else if(result.affectedRows === 0) {
            self.logger.debug("favorite not found");
            self.sendError(res, 404, "NOT_FOUND", "Favorite not found");
        }
        else {
            self.sendResponse(res, null, 204);
        }
    });
};



/******************************************************************************
 * AUTHENTICATION
 *   The authentication of requests seems outside of the scope of this project
 *   as I would be expected a seperate authentication server to manage this
 *   with a secure perimeter or similar to authorize requests. However, since
 *   this demo is to run as a standalone service, and a way to identify users
 *   is required, I've written a very basic authentication system.
 *
 *   In otherwords, this is in no way suitable for a production like system
 *
 *****************************************************************************/

///////////////////////////////////////
// 
// login (demo purposes only)
// 
///////////////////////////////////////
UberFavorites.prototype.login = function(res, requestData) {
    var self = this;
    
    self.logger.info("processing login request");
    
    if(!requestData.email || !requestData.password) {
        self.logger.debug("missing params in login request");
        self.sendError(res, 422, "MISSING_PARAMS", "Missing parameters in request body");
        return;
    }
    
    // Get user info from DB and check password hash
    self.database.getUserByEmail(requestData.email, function(err, user) {
        if(err) {
            self.logger.debug("unable to get user from database");
            self.sendError(res, 401, "UNAUTHORIZED", "Unable to authenticate user");
        }
        else if(!passwordHash.verify(requestData.password, user.password)) {
            self.logger.debug("invalid password in request");
            self.sendError(res, 401, "UNAUTHORIZED", "Unable to authenticate user");
        }
        else {
            self.logger.debug("successfully authenticated user " + user.email);
            
            // Generate a 'random' string for auth token and save it to authSessions
            var token = '';
            while(token.length < 25) {
                token += Math.random().toString(36).substring(2,3);
            }
            
            self.authSessions[token] = user.uuid;
            
            self.sendResponse(res, JSON.stringify({ userId: user.uuid, authToken: token}));
        }
    });
}


///////////////////////////////////////
// 
// authenticateRequest (demo purposes only)
// 
///////////////////////////////////////
UberFavorites.prototype.authenticateRequest = function(res, userId, token, next) {
    var self = this;
    
    if(!userId || !token) {
        self.logger.debug("no token or userid present in request");
        self.sendError(res, 401, "UNAUTHORIZED", "No authentication token in request");
    }
    else if(self.authSessions[token] && self.authSessions[token] === userId) {
        self.logger.debug("successfully authenticated request");
        next();
    }
    else {
        self.logger.debug("invalid token in request - user:" + userId + "  token:" + token);
        self.sendError(res, 401, "UNAUTHORIZED", "Authentication token is invalid for this user");
    }    
}




/******************************************************************************
 * START OF EXECUTION
 *****************************************************************************/


function printUsageAndExit(err) {
    if(err) {
        console.log("\nERROR: " + err + "\n");
    }
    console.log("Usage: node UberFavorites.js config.json [instance_number]\n\n" +
                " - config.json: Path to a JSON formatted config file.\n\n" +
                " - instance_number (optional, defaults to 0): Allows multiple instances of\n" +
                "    the same server to run on the same machine. The port number used by\n" +
                "    each instance will be the server's port number + the instance number.\n");
    process.exit(1);  
}

// Check number of args
var argv = process.argv;
if(argv.length < 3) {
    printUsageAndExit("Not enough arguments");
}

// Read config file
var config;
try {
    config = JSON.parse(fs.readFileSync(argv[2]));
}
catch (err) {
    printUsageAndExit("Cannot read config file - " + err);
}

// Set instance number if in args
config.instanceNumber = argv[3] || 0;

if(require.main === module) {
    process.on('SIGTERM', function() {
        console.log('Got SIGTERM.  Exiting');
        process.exit(0);
    });
    process.on('SIGHUP', function() {
        console.log('Got SIGHUP signal.  Exiting');
        process.exit(0);
    });
    process.on('SIGINT', function() {
        console.log('Got SIGHUP signal.  Exiting');
        process.exit(0);
    });
    
    new UberFavorites(config);
}