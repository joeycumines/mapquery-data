/*
	Implementation of the MapQuery specification for the Home-owner Community project.
	
	Global Fields:
	- boundingBox
		- see definition
		- Should be used for most queries, to limit unnecessary data transfer.
		- Does not allow null, and if not explicitly set will return nothing for most queries.
	- 
	
	Filters:
	- qldAusLocalities
		- Uses boundingBox global
*/

//location.origin implementation for old browsers.
if (!window.location.origin) {
	window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
}

/*Macros for field checking*/
/**
	Macro for object type checking.
*/
function isAnyObject(_value) {
	return _value != null && (typeof _value === 'object' || typeof _value === 'function');
}
/**
	Macro for array type checking.
*/
function isArrayObject(_value) {
	if (isAnyObject(_value) && Object.prototype.toString.call( _value ) === '[object Array]' ) {
		return true;
	}
	return false;
}
/**
	Macro for checking is int. Not foolproof for some types.
*/
function isInt(_n) {
	return Number(_n) === _n && _n % 1 === 0;
}
/**
	Macro for checking is float. Not foolproof for some types.
*/
function isFloat(_n) {
	return Number(_n) === _n && _n % 1 !== 0;
}
/**
	Macro for checking is number. Not foolproof for some types.
*/
function isNumber(_n) {
	return Number(_n) === _n;
}

/**
	Constructor for this implementation.
	
	Creating a new one for every query would be easiest.
*/
function MapQueryHomeowner() {
	//call super
	MapQuery.call(this);
	
	//set up our filters and fields.
	this.fields.boundingBox = new FieldBoundingBox();
	
	this.filters.qldAusLocalities = new FilterQldAusLocalities();
	this.filters.googleMapsPlaces = new FilterGoogleMapsPlaces();
}
/**
	getStatus uses super.
*/
MapQueryHomeowner.prototype.getStatus = function() {return MapQuery.prototype.getStatus.call(this);}
/**
	fetch uses super.
*/
MapQueryHomeowner.prototype.fetch = function(_simul, _limit, _oldMapQueries = null) {return MapQuery.prototype.fetch.call(this, _simul, _limit, _oldMapQueries);}
/**
	Add to map uses super.
*/
MapQueryHomeowner.prototype.addToMap = function() {return MapQuery.prototype.addToMap.call(this);}
/**
	toJSON uses super.
*/
MapQueryHomeowner.prototype.toJSON = function() {return MapQuery.prototype.toJSON.call(this);}
/**
	fromJSON uses super.
*/
MapQueryHomeowner.prototype.fromJSON = function(_json) {return MapQuery.prototype.fromJSON.call(this, _json);}

/*Field definition: FieldBoundingBox*/
function FieldBoundingBox(_value = null) {
	MapQueryField.call(this, _value);
	//we don't allow nulls for this field, so we set here
	if (this.value == null)
		MapQueryField.prototype.set.call(this, {'topLeftLat':0,'topLeftLng':0,'bottomRightLat':0,'bottomRightLng':0});
}
/**
	Validate method, overrides default.
*/
FieldBoundingBox.prototype.validate = function(_value) {
	//if we are object
	if (!isAnyObject(_value))
		return false;
	//do we have the fields we want
	if (_value.hasOwnProperty('topLeftLat') == false || _value.hasOwnProperty('topLeftLng') == false || 
			_value.hasOwnProperty('bottomRightLat') == false || _value.hasOwnProperty('bottomRightLng') == false)
		return false;
	if (isNumber(_value.topLeftLat) == false || isNumber(_value.topLeftLng) == false ||
			isNumber(_value.bottomRightLat) == false || isNumber(_value.bottomRightLng) == false)
		return false;
	return true;
}
/**
	Set method, uses default.
*/
FieldBoundingBox.prototype.set = function(_value){return MapQueryField.prototype.set.call(this, _value);}

/*Filter definition: FilterQldAusLocalities*/
/**
	This filter returns the boundaries all localities in Qld, Australia, that are within the
	global field boundingBox, or overlap with it.
*/
function FilterQldAusLocalities() {
	//call the super
	MapQueryFilter.call(this);
}
/**
	Fetch implementation. Using the global boundingBox field we GET
	filters/filter_qld_localities.php
*/
FilterQldAusLocalities.prototype.fetch = function (_mapQuery, _oldMapQueries = null) {
	//clear old results
	this.features.length = 0;
	
	var topLeftLat, topLeftLng, bottomRightLat, bottomRightLng;
	topLeftLat = _mapQuery.fields.boundingBox.value.topLeftLat;
	topLeftLng =  _mapQuery.fields.boundingBox.value.topLeftLng;
	bottomRightLat =  _mapQuery.fields.boundingBox.value.bottomRightLat;
	bottomRightLng =  _mapQuery.fields.boundingBox.value.bottomRightLng;
	
	var xhttp = new XMLHttpRequest();
	
	var filter = this;
	xhttp.onreadystatechange = function() {
		//if we are done
		if (xhttp.readyState == 4) {
			//success
			if (xhttp.status == 200) {
				filter.status = 'success';
				//callback to start next one(s)
				if (_mapQuery.query != null)
					_mapQuery.query.callback(_mapQuery);
				//attempt to parse the result.
				var temp = xhttp.responseText.trim();
				try {
					temp = JSON.parse(temp);
				} catch (e) {
					temp = null;
				}
				if (temp == null || temp == '' || temp['status'] != 'success') {
					//failure by php
					filter.status = 'failure';
				} else {
					//success!
					filter.features = temp['result'];
					
					//Set our style preferences.
					//We want to open an info window, containing a html table of our properties.
					//witchcraft
					for (var x = 0 ; x < filter.features.length; x++) {
						var feature = filter.features[x];
						//set a property to represent the info window
						feature.properties.infowindow = null;
						
						feature.properties.helpers = {};
						
						//remove the info window.
						feature.properties.helpers.removeInfo = function(_feature) {
							//exit if we are already cleared.
							if (_feature.getProperty('infowindow') == null)
								return;
							_feature.getProperty('infowindow').close();
							_feature.setProperty('infowindow', null);
						}
						
						//display the info window at position.
						feature.properties.helpers.addInfo = function(_feature, _pos) {
							//remove if already existed
							if (_feature.getProperty('infowindow') != null)
								_feature.getProperty('helpers').removeInfo(_feature);
							var infowindow = new google.maps.InfoWindow({
									content: _feature.getProperty('id')
								});
							infowindow.setPosition(_pos);
							infowindow.open(map);
							_feature.setProperty('infowindow', infowindow);
						}
						
						//set the on click handler
						feature.properties.featureClick = function(_feature, _event) {
							//we have access to both the origional info, and the feature object on google maps.
							var pos = null;
							var tempG = _feature.getGeometry();
							if (tempG.getType() == 'MultiPolygon')
								pos = tempG.getAt(0).getAt(0).getAt(0);
							else
								pos = tempG.getAt(0).getAt(0);
							
							_feature.getProperty('helpers').addInfo(_feature, pos);
						}
					}
					
					filter.status = 'success';
				}
			} else {
				//failure by http
				filter.status = 'failure';
			}
		}
	};
	xhttp.open("GET", window.location.origin + "/filters/filter_qld_aus_localities.php?topLeftLat="+topLeftLat+"&topLeftLng="+topLeftLng+"&bottomRightLat="+bottomRightLat+"&bottomRightLng="+bottomRightLng, true);
	xhttp.send();
	
	return true;
}
/**
	getStatus uses super for now.
*/
FilterQldAusLocalities.prototype.getStatus = function(){return MapQueryFilter.prototype.getStatus.call(this);}
/**
	clear uses super.
*/
FilterQldAusLocalities.prototype.clear = function(){MapQueryFilter.prototype.clear.call(this);}
/**
	Add to map uses super.
*/
FilterQldAusLocalities.prototype.addToMap = function(){return MapQueryFilter.prototype.addToMap.call(this);}

/*Field definition: FieldGooglePlacesType*/
function FieldGooglePlacesType(_value = null) {
	MapQueryField.call(this, _value);
	//we don't allow nulls for this field, so we set here
	if (this.value == null)
		MapQueryField.prototype.set.call(this, []);
}
/**
	Validate method, overrides default.
*/
FieldGooglePlacesType.prototype.validate = function(_value) {
	//if we are an array
	if (!isArrayObject(_value))
		return false;
	//do all our fields match the specification here https://developers.google.com/places/supported_types#table1
	var valid = {
		accounting : 0,
		airport : 0,
		amusement_park : 0,
		aquarium : 0,
		art_gallery : 0,
		atm : 0,
		bakery : 0,
		bank : 0,
		bar : 0,
		beauty_salon : 0,
		bicycle_store : 0,
		book_store : 0,
		bowling_alley : 0,
		bus_station : 0,
		cafe : 0,
		campground : 0,
		car_dealer : 0,
		car_rental : 0,
		car_repair : 0,
		car_wash : 0,
		casino : 0,
		cemetery : 0,
		church : 0,
		city_hall : 0,
		clothing_store : 0,
		convenience_store : 0,
		courthouse : 0,
		dentist : 0,
		department_store : 0,
		doctor : 0,
		electrician : 0,
		electronics_store : 0,
		embassy : 0,
		fire_station : 0,
		florist : 0,
		funeral_home : 0,
		furniture_store : 0,
		gas_station : 0,
		grocery_or_supermarket : 0,
		gym : 0,
		hair_care : 0,
		hardware_store : 0,
		hindu_temple : 0,
		home_goods_store : 0,
		hospital : 0,
		insurance_agency : 0,
		jewelry_store : 0,
		laundry : 0,
		lawyer : 0,
		library : 0,
		liquor_store : 0,
		local_government_office : 0,
		locksmith : 0,
		lodging : 0,
		meal_delivery : 0,
		meal_takeaway : 0,
		mosque : 0,
		movie_rental : 0,
		movie_theater : 0,
		moving_company : 0,
		museum : 0,
		night_club : 0,
		painter : 0,
		park : 0,
		parking : 0,
		pet_store : 0,
		pharmacy : 0,
		physiotherapist : 0,
		plumber : 0,
		police : 0,
		post_office : 0,
		real_estate_agency : 0,
		restaurant : 0,
		roofing_contractor : 0,
		rv_park : 0,
		school : 0,
		shoe_store : 0,
		shopping_mall : 0,
		spa : 0,
		stadium : 0,
		storage : 0,
		store : 0,
		subway_station : 0,
		synagogue : 0,
		taxi_stand : 0,
		train_station : 0,
		transit_station : 0,
		travel_agency : 0,
		university : 0,
		veterinary_care : 0,
		zoo : 0
	};
	for (var x = 0; x < _value.length; x++) {
		if (!valid.hasOwnProperty(_value[x])) {
			return false;
		}
	}
	return true;
}
/**
	Set method, uses default.
*/
FieldGooglePlacesType.prototype.set = function(_value){return MapQueryField.prototype.set.call(this, _value);}

/*Filter definition: FilterGoogleMapsPlaces*/
/**
	This filter returns the boundaries all localities in Qld, Australia, that are within the
	global field boundingBox, or overlap with it.
*/
function FilterGoogleMapsPlaces() {
	//call the super
	MapQueryFilter.call(this);
	this.fields.place_types = new FieldGooglePlacesType();
	this.total_types_queried = 0;
}

/**
	One info window for a google place is able to be displayed at a time.
*/
var placeInfoWindow = null;

/**
	Used internally to query for the next type.
*/
FilterGoogleMapsPlaces.prototype.nextPlace = function(_mapQuery, _oldMapQueries = null) {
	//exit if we are done.
	if (this.total_types_queried >= this.fields.place_types.value.length) {
		this.status = 'success';
		console.log(this.features);
		return;
	}
	
	//get our current type
	var currentType = this.fields.place_types.value[this.total_types_queried];
	
	//get our vars for querying
	var topLeftLat, topLeftLng, bottomRightLat, bottomRightLng;
	topLeftLat = _mapQuery.fields.boundingBox.value.topLeftLat;
	topLeftLng =  _mapQuery.fields.boundingBox.value.topLeftLng;
	bottomRightLat =  _mapQuery.fields.boundingBox.value.bottomRightLat;
	bottomRightLng =  _mapQuery.fields.boundingBox.value.bottomRightLng;
	
	var xhttp = new XMLHttpRequest();
	console.log(window.location.origin + "/filters/filter_google_maps_places.php?topLeftLat="+topLeftLat+"&topLeftLng="
			+topLeftLng+"&bottomRightLat="+bottomRightLat+"&bottomRightLng="+bottomRightLng+"&type="+currentType);
	var filter = this;
	xhttp.onreadystatechange = function() {
		//if we are done
		if (xhttp.readyState == 4) {
			//successfully fetched a type
			if (xhttp.status == 200) {
				//callback to start next one(s)
				if (_mapQuery.query != null)
					_mapQuery.query.callback(_mapQuery);
				//attempt to parse the result.
				var temp = xhttp.responseText.trim();
				try {
					temp = JSON.parse(temp);
				} catch (e) {
					temp = null;
				}
				if (temp == null || temp == '' || temp['status'] != 'success') {
					//failure by php, we don't do anything
				} else {
					//success!
					
					//handle styling.
					for (var x = 0 ; x < temp['result'].length; x++) {
						var feature = temp['result'][x];
						
						feature.properties.featureSetStyle = function(_feature, _event) {
							var placeData = _feature.getProperty('google_data');
							if (placeData.hasOwnProperty('icon')){
								var temp = {};
								temp.icon = 'https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2000&resize_w=30&url='+placeData.icon;
								return temp;
							}
							return({});
						}
						
						feature.properties.featureMouseOver = function(_feature, _event) {
							//we have access to both the original info, and the feature object on google maps.
							var pos = null;
							var tempG = _feature.getGeometry();
							if (tempG.getType() == 'Point')
								pos = tempG.get();
							//close any existing info windows
							if (placeInfoWindow != null) {
								placeInfoWindow.close();
								placeInfoWindow = null;
							}
							var placeData = _feature.getProperty('google_data');
							//make a new info window
							var windowConst = {pixelOffset: new google.maps.Size(0, -40)};
							windowConst['content'] = placeData.name+'<br><a href="http://maps.google.com/?q='+encodeURI(placeData.name+' '+placeData.vicinity)+'">View More Details</a>';
							placeInfoWindow = new google.maps.InfoWindow(windowConst);
							placeInfoWindow.setPosition(pos);
							placeInfoWindow.open(map);
							
						}
					}
					
					//add to final.
					filter.features = filter.features.concat(temp['result']);
				}
			}
			//increment filter
			filter.total_types_queried++;
			//start the next one, and handle the result.
			filter.nextPlace(_mapQuery, _oldMapQueries);
		}
	};
	xhttp.open("GET", window.location.origin + "/filters/filter_google_maps_places.php?topLeftLat="+topLeftLat+"&topLeftLng="
			+topLeftLng+"&bottomRightLat="+bottomRightLat+"&bottomRightLng="+bottomRightLng+"&type="+currentType, true);
	xhttp.send();
}

/**
	Fetch implementation. Using the global boundingBox field we GET
	filters/filter_qld_localities.php
*/
FilterGoogleMapsPlaces.prototype.fetch = function (_mapQuery, _oldMapQueries = null) {
	//clear old results
	this.features.length = 0;
	//used for status
	this.total_types_queried = 0;
	
	//starts a queue of fetching that uses this.total_types_queried.
	this.nextPlace(_mapQuery, _oldMapQueries);
	
	return true;
}
/**
	getStatus implementation that updates per type request.
*/
FilterGoogleMapsPlaces.prototype.getStatus = function() {
	var perc = 0;
	if (this.fields.place_types.value.length > 0)
		perc = this.total_types_queried / this.fields.place_types.value.length;
	if (this.status == 'success')
		perc = 1;
	return new MapQueryStatus(this.status, perc, '(default message)');
}
/**
	clear uses super.
*/
FilterGoogleMapsPlaces.prototype.clear = function(){MapQueryFilter.prototype.clear.call(this);}
/**
	Add to map uses super.
*/
FilterGoogleMapsPlaces.prototype.addToMap = function(){return MapQueryFilter.prototype.addToMap.call(this);}
