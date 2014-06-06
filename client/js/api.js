(function() {
    (function(root) {
        var UberAPI;
        UberAPI = (function() {
            
            function UberAPI() {
                this.hostName = "http://localhost:8088";
            }
            
            UberAPI.prototype.isLoggedIn = function() {
                if(localStorage.auth) {
                    try {
            		    var authData = JSON.parse(localStorage.auth);
            			if(authData.userId && authData.authToken) {
            			    this.userId = authData.userId;
                            this.authToken = authData.authToken;
                            return true;
            			}
              		} catch (error) {
              			console.log(error);
              		}
                }
                return false;
            };
            
            UberAPI.prototype.login = function(email, password, callback) {
                var self = this;
                $.ajax({
                    type: "POST",
                    url: self.hostName + "/login",
                    contentType: 'application/json',
                    data: JSON.stringify({ email: email, password: password}),
                    dataType: 'json',
                    success: function(response) {
                        // Successfully logged in, set token and uuid
                        self.userId = response.userId;
                        self.authToken = response.authToken;
                        localStorage.auth = JSON.stringify(response);
                        callback(true);
                    },
                    error: function(err) {
                        // Failed to login
                        callback(false); 
                    }
                });
            };
            
            UberAPI.prototype.logout = function() {
                localStorage.removeItem('auth');
                location.reload();
            };
            
            UberAPI.prototype.getFavorites = function(callback) {
                $.ajax({
                    type: "GET",
                    url: this.hostName + "/users/" + this.userId + "/favorites",
                    data: { token: this.authToken },
                    dataType: 'json',
                    success: function(response) {
                        callback(false, response);
                    },
                    error: function(err) {
                        callback(true); 
                    }
                });
            };
            
            UberAPI.prototype.addFavoriteByAddress = function(address, callback) {
                $.ajax({
                    type: "POST",
                    url: this.hostName + "/users/" + this.userId + "/favorites?token=" + encodeURIComponent(this.authToken),
                    contentType: 'application/json',
                    data: JSON.stringify({ address: address }),
                    dataType: 'json',
                    success: function(response) {
                        // Favorite added
                        callback(false, response);
                    },
                    error: function(err) {
                        // Failed to login
                        callback(true); 
                    }
                });
            };
            
            UberAPI.prototype.addFavoriteByLatLng = function(lat, lng, callback) {
                $.ajax({
                    type: "POST",
                    url: this.hostName + "/users/" + this.userId + "/favorites?token=" + encodeURIComponent(this.authToken),
                    contentType: 'application/json',
                    data: JSON.stringify({ latitude: lat, longitude: lng }),
                    dataType: 'json',
                    success: function(response) {
                        // Favorite added
                        callback(false, response);
                    },
                    error: function(err) {
                        // Failed to login
                        callback(true); 
                    }
                });
            };
            
            UberAPI.prototype.deleteFavorite = function(favId, callback) {
                $.ajax({
                    type: "DELETE",
                    url: this.hostName + "/users/" + this.userId + "/favorites/" + favId + "?token=" + encodeURIComponent(this.authToken),
                    success: function() {
                        callback(false);
                    },
                    error: function(err) {
                        callback(true); 
                    }
                });
            };
            
            
            return UberAPI;

        })();
        return root.UberAPI = UberAPI;
  })(this);
}).call(this);

