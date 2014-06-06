(function() {
    
    var api = new UberAPI();
    
    $(document).ready(function() {
        if(api.isLoggedIn()) {
            showFavoritesPage();
        }
        else {
            showLoginPage();
        } 
    });
    
    // Screen loaders
    var showLoginPage = function() {
        $('#login').show();
    }
    
    var showFavoritesPage = function() {
        $('#main').show();
        
        api.getFavorites(function(err, favorites) {
            if(err) {
                alert("Error getting favorites");
                return;
            }
            
            var mapOptions = {
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                center: new google.maps.LatLng(41.850033, -87.6500523),
                zoom: 4
            };
            
            var map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
            
            var infowindow = new google.maps.InfoWindow();

            var bounds = new google.maps.LatLngBounds();
            
            for (var i = 0; i < favorites.length; i++) {
                var marker = new google.maps.Marker({
                    position: new google.maps.LatLng(favorites[i].latitude, favorites[i].longitude),
                    map: map
                });

                bounds.extend(marker.position);

                google.maps.event.addListener(marker, 'click', (function (marker, i) {
                    return function () {
                        // Create DOM for info window
                        var content = '<p><b>' + favorites[i].name + '</b></p>' +
                                      '<p>' + favorites[i].streetNumber + ' ' + favorites[i].streetName +
                                      '<br>' + favorites[i].city + '</p>' +
                                      '<p><a href="#" onclick="deleteFavorite(\'' + favorites[i].id + '\')">Delete</a></p>';
                        
                        infowindow.setContent(content);
                        infowindow.open(map, marker);
                    }
                })(marker, i));
            }
            
            // Add mouse click event - avoid accidental clicks from zoom-in by requiring hold for 1 second
            var clickTimeout;
            google.maps.event.addListener(map, 'mousedown', function(event) {
                clickTimeout = setTimeout(function() {
                    clickTimeout = null;
                    
                    // Event action starts here
                    var marker = new google.maps.Marker({position: event.latLng, map: map});
                    
                    var content = '<a href="#" onclick="addFavorite(\'' + event.latLng.lat() + '\',\'' + event.latLng.lng() + '\')">Add this location as favorite</a>' 
                    
                    var infowindow = new google.maps.InfoWindow({
                          content: content
                    });
                    infowindow.open(map,marker);
                    
                    // Remove marker when infowindow is closed
                    google.maps.event.addListener(infowindow,'closeclick', function() {
                        marker.setMap(null);
                    }); 
                        
                 }, 1000);
            });
            google.maps.event.addListener(map, 'mouseup', function(event) {
                if (clickTimeout !== null) {
                    clearTimeout(clickTimeout);
                }
            });
            google.maps.event.addListener(map, 'mousemove', function(event) {
                if (clickTimeout !== null) {
                    clearTimeout(clickTimeout);
                }
            });   
            
            // Just to make sure we're not zoomed in super close
            google.maps.event.addListenerOnce(map, 'bounds_changed', function() {
                if(map.getZoom() > 15) {
                    map.setZoom(15);
                }
            });

            if(favorites.length === 0) {
                alert("No favorites set");
            }
            else {
                map.fitBounds(bounds);
            }  
        });
    }
    
    
    // Event handlers
    $('#login-form').submit(function(event) {
        event.preventDefault();
        var email = $("input#email").val();
        var password = $("input#password").val()
        
        api.login(email, password, function(loggedIn) {
           if(loggedIn) {
               $('#login').hide();
               showFavoritesPage();
           }
           else {
               alert("Login failed");
           } 
        });
    });
    
    $('#logout').click(function() {
       api.logout(); 
    });
    
    $('#add-favorite-form').submit(function(event) {
        event.preventDefault();
        var address = $("input#address").val();
        
        api.addFavoriteByAddress(address, function(err) {
           if(!err) {
               showFavoritesPage();
           }
           else {
               alert("Failed to add favorite");
           } 
        });
    });
    
    // Global onclick events
    deleteFavorite = function(favId) {
        api.deleteFavorite(favId, function(err) {
           if(!err) {
               showFavoritesPage();
           }
           else {
               alert("Failed to delete favorite");
           } 
        });
    };
    
    addFavorite = function(lat, lng) {
        api.addFavoriteByLatLng(lat, lng, function(err) {
           if(!err) {
               showFavoritesPage();
           }
           else {
               alert("Failed to add favorite");
           } 
        });
    };
    
    
    

}).call(this);
      
      