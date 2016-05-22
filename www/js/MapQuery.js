/*
	MapQuery is a vanilla JavaScript toolset to integrate disparate data sets into a single
	"display application", such as implementation in google maps.
	
	Notes:
	- Only vanilla js at it's core
	- Primarily GeoJSON support, can be extended to support things like Google Maps markers.
	- Framework, structure is provided in this library, but implementation dependant.
	
	Objects:
	- MapQueryField
		- Encapsulates a field that can be provided
		- Usage as keyed objects
		- Fields:
			- value
				- this field's value
		- Members
			- set(mixed)
				- checks validity and then sets the field
			- validate(mixed)
				- default true
				- must be implemented
	- MapQueryFilter
		- Filters are how data is fetched
		- Encapsulates and stores data fetched from a source
			- Data stored as array of "Feature" objects (GeoJSON specification)
		- Support for partial re-query
		-Methods:
			- Constructor
				- Does nothing but setup
			- fetch(MapQuery, [MapQuery])
				- must be implemented
				- Second parameter is an array of old queries we want to check for data from.
			- getStatus
				- Returns a MapQueryStatus about current state
			- clear
				- Frees features from memory
			- addToMap
				- returns either null or an array of geojson features
				- Must be implemented.
		-Members:
			- features
				- Array of feature json objects (geojson spec)
			- fields
				- Array of MapQueryField that can be set
			- enabled
	- MapQueryStatus
		- constructor
			- set fields
		-Fields:
			- status:
				- success, failure, running
			- completePercent
				- <= 1
			- message
				- descriptive string about what is going on. Might be blank.
	- MapQuery
		-Fields:
			- filters
				- array
				- All available filters for use
				- Work directly with these filters for setting etc.
			- fields
				- top level fields
		- Methods
			- constructor
				- filters, fields
			- getStatus
				- returns consolidated MapQueryStatus of all enabled filters.
			- fetch(maxsimul, limit, [MapQuery])
				- fetches a limited number of features, with maxsimul queries
				- the third parameter is optional and defaults null
			- toJSON
				- returns the current state of the MapQuery object as a json
			- fromJSON
				- Loads the state from a json
			- addToMap
				- must be implemented
*/

/*MapQueryStatus implementation*/

/**
	Constructor for MapQueryStatus object, represents the status of a fetching
	task.
	- Just provides structure of the result that will be returned.
*/
function MapQueryStatus(_status, _completePercent, _message) {
	this.status = _status;
	this.completePercent = _completePercent;
	this.message = _message;
}

/*MapQueryField implementation*/
/**
	Constructor for the MapQueryField object, initialize with value.
*/
function MapQueryField(_value = null) {
	this.value = null;
	this.set(_value);
}
/**
	This should be overridden to provide validation and sanity checks.
	
	Returns true or false.
*/
MapQueryField.prototype.validate = function(_value) {
	return true;
}
/**
	Sets the field's value.
	
	Returns true if we validated, else false.
*/
MapQueryField.prototype.set = function(_value) {
	if (this.validate(_value)){
		this.value = _value;
		return true;
	}
	return false;
}

/*MapQueryFilter implementation*/
/**
	Sets up filter object.
	
	Implementation of most of the members of this object are left entirely
	up to the client.
	- fetch must start some kind of async query to get the data we want.
		- it must call _mapQuery.query.callback(_mapQuery); once done.
		- Then it must set the current state to success
	- getStatus must update us with the current status, and always end with either status failure or success.
	- if we need some other kind of map display implementation, addToMap must perform this.
*/
function MapQueryFilter() {
	this.features = [];
	this.fields = {};
	this.enabled = false;
	this.status = 'success';
}

/**
	Fetch data using a new MapQuery. 
	
	-------BIG NOTE--------
	If sync fetching is desired, just do it here then return false.
	The status will be set for you automatically.
	
	_mapQuery:
		- Current query
	_callback:
		- Executed on completion of the fetch.
	_oldMapQueries:
		- Array of completed queries to reuse data OR null
	
	Returns true if we started a async method, else false.
	
	This method needs to call the _mapQuery.query.callback(_mapQuery) member, otherwise
	it will break.
*/
MapQueryFilter.prototype.fetch = function (_mapQuery, _oldMapQueries = null) {
	//must be implemented
	return false;
}

/**
	Return a MapQueryStatus object telling us about the current status of the query.
	
	success, failure, running
*/
MapQueryFilter.prototype.getStatus = function() {
	var perc = 0;
	if (this.status == 'success')
		perc = 1;
	return new MapQueryStatus(this.status, perc, '(default message)');
}
/**
	Clear all of the features.
*/
MapQueryFilter.prototype.clear = function() {
	this.features.length = 0;
}

/**
	Add to map. This default implementation just returns the features,
	but this functionality should be extended in order to allow usage with
	non geojson results.
*/
MapQueryFilter.prototype.addToMap = function() {
	return this.features;
}

/*MapQuery implementation*/
/**
	Constructor for the MapQuery object.
	Just initializes.
*/
function MapQuery() {
	this.fields = {};
	this.filters = {};
	this.query = null;
}

/**
	Returns a consolidated status of all currently running fields.
	
	success, failure, running
*/
MapQuery.prototype.getStatus = function() {
	var enabledFilters = 0;
	var succeededFilters = 0;
	var completedFilters = 0;
	var errorMessages = '';
	var completePercent = 0;
	
	//loop through all filters and do status checks.
	for (var k in this.filters) {
		if (this.filters.hasOwnProperty(k) && this.filters[k].enabled) {
			var status = this.filters[k].getStatus();
			//increment enabled filters
			enabledFilters++;
			
			//increment amount we are complete
			completePercent+= status.completePercent;
			
			//increment completed filters
			if (status.status == 'success' || status.status == 'failure')
				completedFilters++;
			//increment succeeded filters
			if (status.status == 'success')
				succeededFilters++;
			//add error message
			if (status.status == 'failure')
				errorMessages+='\n'+status.message;
		}
	}
	completePercent = completePercent / enabledFilters;
	
	//still fetching
	if (completedFilters < enabledFilters && enabledFilters > 0)
		return new MapQueryStatus('running', completePercent, 'We are still working, '+(completedFilters-succeededFilters)+' of '+completedFilters+' failed.');
	
	//all are done
	
	//if we failed every single filter
	if (succeededFilters <= 0 && enabledFilters != 0)
		return new MapQueryStatus('failure', 0.0, 'All '+enabledFilters+' failed!'+errorMessages);
	//if we get to here, then we are done.
	return new MapQueryStatus('success', 1.0, succeededFilters+' of '+enabledFilters+' sources completed!'+errorMessages);
}

/**
	Fetches, for all enabled filters, and the fields set in both this and it's filter's fields.
	_simul:
		- The maximum simultaneous filter fetching tasks.
	_limit:
		- The maximum number of geojson Features that can be returned (exits).
		- This is done in a look back fashion; it is likely the total number of features will be greater then specified.
	_oldMapQueries:
		- An array of previous MapQuery objects that we are going to check for reusable data.
			- passes any matching filters from previous queries onwards.
	
	This method is done in a async fashion. All enabled filters are pushed into an array,
	and on the completion callback of the fetch method this array is checked.
	
	Returns if we started or not.
*/
MapQuery.prototype.fetch = function(_simul, _limit, _oldMapQueries = null) {
	//if we are already fetching we do nothing
	if (this.query != null)
		return false;
	
	//set the parameters as the query object
	this.query = {};
	this.query.simul = _simul;
	this.query.limit = _limit;
	this.query.oldMapQueries = _oldMapQueries;
	this.query.todo = [];
	
	//push all todo filters into the array
	for (k in this.filters) {
		if (this.filters.hasOwnProperty(k) && this.filters[k].enabled) {
			//we want to do this one.
			this.query.todo.push(this.filters[k]);
			//set the status of all these to running for status checking
			this.filters[k].status = 'running';
		}
	}
	
	//create our callback method
	this.query.callback = function(_mapQuery) {
		
		//if we don't have any tasks to do, we just exit, and reset for next time.
		if (_mapQuery.query.todo.length <= 0) {
			_mapQuery.query = null;
			return;
		}
		
		//we want to start as many fetch tasks as we can.
		//if a fetch task returns true, then we set to running, else success.
		
		//but first, we need to check if we are at our limit.
		var features = 0;
		var totalTasksRunning = 0;
		for (k in _mapQuery.filters) {
			//if we are real property and filter is enabled
			if (_mapQuery.filters.hasOwnProperty(k) && _mapQuery.filters[k].enabled) {
				var status = _mapQuery.filters[k].getStatus();
				if (status.status == 'success') {
					//increment by number of geojson features
					features+= _mapQuery.filters[k].features.length;
					
					//exit condition here, if features >= _mapQuery.query.limit
					if (_mapQuery.query.limit > 0 && features > _mapQuery.query.limit) {
						//reset then exit
						_mapQuery.query = null;
						return;
					}
				} else if (status.status == 'running') {
					//we are running
					totalTasksRunning++;
				}
			}
		}
		
		//exit condition here if we have too many tasks running.
		if (_mapQuery.query.simul > 0 && totalTasksRunning >= _mapQuery.query.simul) {
			//reset then exit
			_mapQuery.query = null;
			return;
		}
		
		//try to enable a filter fetch, then call this again.
		while(_mapQuery.query.todo.length > 0) {
			//take off the top
			var filter = _mapQuery.query.todo[_mapQuery.query.todo.length-1];
			_mapQuery.query.todo.pop();
			//try to start it fetching
			if (filter.fetch(_mapQuery, _mapQuery.query.oldMapQueries)) {
				//we are running, call this again and exit this one.
				_mapQuery.query.callback(_mapQuery);
				return;
			} else {
				//set state to success, we assume either a) nothing to do or b) synchronous query
				filter.status = 'success';
			}
		}
		
		//we should never get here, reset then exit
		_mapQuery.query = null;
		return;
	}
	
	//call our callback to start our fetching
	this.query.callback(this);
	
	return true;
}

/**
	Adds the currently stored results of the filters to the map.
	
	Calls the addToMap methods of all enabled filters.
	
	Returns an array of feature objects, to be added into the data layer.
*/
MapQuery.prototype.addToMap = function() {
	/*var result = {};
	result.type = 'FeatureCollection';
	result.features = [];
	
	for (var k in this.filters) {
		if (this.filters.hasOwnProperty(k) && this.filters[k].enabled) {
			//call the add to map method of this filter to get features
			result.features = result.features.concat(this.filters[k].addToMap());
		}
	}
	*/
	var result = [];
	for (var k in this.filters) {
		if (this.filters.hasOwnProperty(k) && this.filters[k].enabled) {
			//call the addToMap method of this filter to get features
			result = result.concat(this.filters[k].addToMap());
		}
	}
	return result;
}

/**
	Converts the current query state of this object to a simple transferable json.
	
	Returns the json object.
*/
MapQuery.prototype.toJSON = function() {
	var result = {};
	result.fields = {};
	result.filters = {};
	
	//global fields
	for (k in this.fields) {
		if (this.fields.hasOwnProperty(k)) {
			//add this field and value to the result.fields object
			result.fields[k] = this.fields[k].value;
		}
	}
	
	//filters are stored in an object, with sub field key pairs.
	for (k in this.filters) {
		if (this.filters.hasOwnProperty(k) && this.filters[k].enabled) {
			//add as an object
			result.filters[k] = {};
			//set fields for this filter
			for (x in this.filters[k].fields) {
				if (this.filters[k].fields.hasOwnProperty(x)) {
					result.filters[k][x] = this.filters[k].fields[x].value;
				}
			}
		}
	}
	
	return result;
}

/**
	Loads the state from a object formed by toJSON or similar.
	
	Returns the number of unknown or invalid parameters we had.
	
	NOTE: this should only be called by the (IMPLEMENTED) constructor, as it WILL
	result in unexpected behaviour otherwise. If the values are not as
	default, consistent queries are impossible using this method.
*/
MapQuery.prototype.fromJSON = function(_json) {
	var failed = 0;
	
	//set the fields
	for (var k in _json.fields) {
		if (_json.fields.hasOwnProperty(k)) {
			//continue if we don't have this field
			if (!(k in this.fields)) {
				console.log('MapQuery.fromJSON: global field "'+k+'" was not found, ignoring.');
				failed++;
				continue;
			}
			//we have this field, set, increment if failed.
			if (!this.fields[k].set(_json.fields[k])) {
				console.log('MapQuery.fromJSON: global field "'+k+'" was invalid, ignoring. '+JSON.stringify(_json.fields[k]));
				failed++;
			}
		}
	}
	
	//set the filter
	for (var k in _json.filters) {
		if (_json.filters.hasOwnProperty(k)) {
			//continue if we don't have this filter
			if (!(k in this.filters)) {
				console.log('MapQuery.fromJSON: filter "'+k+'" was not found, ignoring. ');
				failed++;
				continue;
			}
			//we have this filter
			//set enabled
			this.filters[k].enabled = true;
			//set all the filter's fields
			for (var x in _json.filters[k]) {
				if (_json.filters[k].hasOwnProperty(x)) {
					//if our version of this filter does not have, fail and continue.
					if (!(x in this.filters[k].fields)) {
						console.log('MapQuery.fromJSON: local field "'+x+'" was not found in filter "'+k+'", ignoring.');
						failed++;
						continue;
					}
					
					//try to add the field to this filter
					if (!this.filters[k].fields[x].set(_json.filters[k][x])) {
						console.log('MapQuery.fromJSON: local field "'+x+'" in filter "'+k+'", was invalid ignoring. '+JSON.stringify(_json.fields[k]));
						failed++;
					}
				}
			}
		}
	}
	
	return failed;
}