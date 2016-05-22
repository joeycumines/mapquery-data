/*
	This file will contain setup, and helper functions relating to the google
	maps api.
*/

//google map object
var map;

//All data. All objects in this array must have setMap implemented for easy clearing.
var data = [];

/**
	GeoJSON wrapper for easier removal and adding.
*/
function GeoJSON(_geoJSON, _map = null) {
	this.geoJSON = _geoJSON;
	this.map = null;
	this.feature = null;
	this.setMap(_map);
}
GeoJSON.prototype.setMap = function(_map) {
	//remove any we have already
	if (this.feature != null) {
		for (var x = 0; x < this.feature.length; x++)
			this.map.data.remove(this.feature[x]);
	}
	//set map var
	this.map = _map;
	//display
	if (this.map != null)
		this.feature = this.map.data.addGeoJson(this.geoJSON);
}

/**
	Sets the map to null for all our data objects, and clears it.
*/
function setMapNull(_arrayOfThings) {
	for (var x = 0; x < _arrayOfThings.length; x++) {
		_arrayOfThings[x].setMap(null);
	}
}

/*
	google maps wrapper methods.
*/
function addMarker(_title, _label, _position) {
	data.push(new google.maps.Marker({
		position: _position,
		map: map,
		title: _title,
		label: _label
		}));
}
function addPolygon(_paths, _strokeColor, _strokeOpacity, _strokeWeight, _fillColor, _fillOpacity) {
	var temp = new google.maps.Polygon({
		paths: _paths,
		strokeColor: _strokeColor,
		strokeOpacity: _strokeOpacity,
		strokeWeight: _strokeWeight,
		fillColor: _fillColor,
		fillOpacity: _fillOpacity
	});
	temp.setMap(map);
	data.push(temp);
	return temp;
}
function addGeoJSON(_jsonToAdd) {
	data.push(new GeoJSON(_jsonToAdd, map));
}
function addGeoJSONArray(_json) {
	for (var x = 0; x < _json.length; x++) {
		data.push(new GeoJSON(_json[x], map));
	}
}
/*
	End google maps wrapper methods.
*/

function handleEventBinding(_propertyKey, _feature, _event) {
	var handler = _feature.getProperty(_propertyKey);
	if (handler == null) {
		//we haven't defined anything to do for this, is fine, but we don't call.
		return {};
	} else {
		return handler(_feature, _event);
	}
}

/**
	Called on initialization of the map.
*/
function initMap() {
	// set the map centered on Australia, displaying the entire country.
	map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: -29.327474, lng: 135.657432},
		zoom: 5
	});
	
/*Listeners for the data layer (geoJSON)
Data layer events

The following events are common to all features, regardless of their geometry type.
To bind any of these, simply give the feature in question a callback method in
a top level property of the 'FEATURE PROPERTY METHOD' signature (do before passing to google).
Note, it only seems to (easily) be able to access properties, not any other level of the geoJSON.

GOOGLE BINDING			FEATURE PROPERTY METHOD

setStyle				featureSetStyle(feature)

addfeature				featureAddFeature(feature)
click					featureClick(feature)
dblclick				featureDblClick(feature)
mousedown				featureMouseDown(feature)
mouseout				featureMouseOut(feature)
mouseover				featureMouseOver(feature)
mouseup					featureMouseUp(feature)
removefeature			featureRemoveFeature(feature)
removeproperty			featureRemoveProperty(feature)
rightclick				featureRightClick(feature)
setgeometry				featureSetGeometry(feature)
setproperty				featureSetProperty(feature)
*/

/**
	Main entry point for styling all features.
	Not reverted with revertStyle().
	Called every time a property is changed.
*/
map.data.setStyle(function(feature) {
	/*var color = 'gray';
	if (feature.getProperty('isColorful')) {
		color = 'red';
	}
	return	({
		fillColor: color,
		strokeColor: color,
		strokeWeight: 2
	});*/
	/*//reverts all overrides
	map.data.revertStyle();
	//sets an override
	map.data.overrideStyle(event.feature, {strokeWeight: 8});*/
	//event.feature.setProperty('isColorful', true);
	return handleEventBinding('featureSetStyle', feature, null);
});

map.data.addListener('addfeature', function(event) {
	handleEventBinding('featureAddFeature', event.feature, event);
});
map.data.addListener('click', function(event) {
	handleEventBinding('featureClick', event.feature, event);
});
map.data.addListener('dblclick', function(event) {
	handleEventBinding('featureDblClick', event.feature, event);
});
map.data.addListener('mousedown', function(event) {
	handleEventBinding('featureMouseDown', event.feature, event);
});
map.data.addListener('mouseout', function(event) {
	handleEventBinding('featureMouseOut', event.feature, event);
	
	//global for mouseover style
	//revert strokeWeight of the one we moused out of
	//map.data.revertStyle(event.feature);
	map.data.overrideStyle(event.feature, {strokeWeight: null});
});
map.data.addListener('mouseover', function(event) {
	handleEventBinding('featureMouseOver', event.feature, event);
	
	//Global mouseover: set stroke weight to 8
	map.data.overrideStyle(event.feature, {strokeWeight: 8});
});
map.data.addListener('mouseup', function(event) {
	handleEventBinding('featureMouseUp', event.feature, event);
});
map.data.addListener('removefeature', function(event) {
	handleEventBinding('featureRemoveFeature', event.feature, event);
});
map.data.addListener('removeproperty', function(event) {
	handleEventBinding('featureRemoveProperty', event.feature, event);
});
map.data.addListener('rightclick', function(event) {
	handleEventBinding('featureRightClick', event.feature, event);
});
map.data.addListener('setgeometry', function(event) {
	handleEventBinding('featureSetGeometry', event.feature, event);
});
map.data.addListener('setproperty', function(event) {
	handleEventBinding('featureSetProperty', event.feature, event);
});

//END initMap()
}
