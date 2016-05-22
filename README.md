# mapquery-data
The implementation of a core vanilla JavaScript API, for retrieval and consolidation of geographical data from multiple sources.
The provided example implementation uses supporting PHP and PostGIS based functionality, for data storage and generation, and interfaces the Google Maps JavaScript API, at the data layer.

##Rationale
The project given was to interface with a machine learning algorithm, that would be intended to display points of interest and other relevant geographical data, specific to a user.
It is a proof of concept to be delivered as part of a individual project unit delivered at QUT as part of my final semester of university.
The medium to be used was a web page, and after consideration of alternatives, Google Maps was chosen for it's comprehensive display API.

It was determined that multiple, disparate, APIs and data sources, would be required, to deliver the functionality that was desired.
The final deliverable, as such, was designed specifically to be extendible for many types of data sources, both dynamic and static, to support caching, and to demonstrate the feasibility of the project.

##Structure
The primary feature of the application was to combine multiple data sources, and this documentation will largely cover how the MapQuery library is designed to work.

###MapQuery
- www
	- js
		- map.js
		- MapQuery.js
		- MapQueryHomeowner.js
	- index.html

This module defines object prototypes, designed to be extended, to make the implementation of multiple data sources, called "filters", to be used.
####map.js
Initialization and implementation of a single Google Maps object. Also contains things like event handlers, etc.

####Object Prototypes
- MapQueryStatus
	- Represents the status of a fetching task
	- Usable as is
- MapQueryField
	- Represents a data field of any type
	- Implementation will enable validation
	- Usable as is
- MapQueryFilter
	- Represents a filter that fetches data from a single source
	- Has individual fields for settings
	- Requires implementation per data source
- MapQuery
	- Main application entry point
	- Has global fields, for example for the viewport bounds
	- Fully implemented methods for queries, serialization, etc, only requires application specific implementation to link filters and fields

For further information see `MapQuery.js`, it is commented and has fairly up to date structure guide.

####MapQueryHomeowner Implementation
The MapQueryHomeowner script implements the prototypes defined in `MapQuery.js`, to create a usable example.

#####Usage
```javascript
//assume we have a cleared map, and access to the map.js, MapQuery.js and MapQueryHomeowner.js scripts

//creating a new instance, starts with all filters disabled, and only default values for parameters
var temp = new MapQueryHomeowner();

//set the bounding box field, as all filters implemented rely on it.
temp.fields.boundingBox.set({'topLeftLat':topLeftLat,'topLeftLng':topLeftLng,'bottomRightLat':bottomRightLat,'bottomRightLng':bottomRightLng});

//enable the filters we wish to use
temp.filters.qldAusLocalities.enabled = true;
temp.filters.googleMapsPlaces.enabled = true;

//set the place_types field of the googleMapsPlaces filter
temp.filters.googleMapsPlaces.fields.place_types.set(["hospital", "cafe"]);
//more information can be found at https://developers.google.com/places/supported_types#table1 only non depreciated types supported.

/* Start fetching. See index.html for a basic implementation of the `checkQuery()`. Polling is used, because we will want
to update the status periodically, anyway.*/
if (query.fetch(5, 0))
	//start our update loop to poll the status.
	checkQuery();

```

The filters defined in `MapQueryHomeowner.js` require a a PHP server and postgresql server running PostGIS. More information on the filter implementation is provided bellow.

#####Filters
######FilterQldAusLocalities
Fetches, for the viewport bounds, the localities of QLD. Requires the global boundingBox parameter.
Binds the onclick event to display a info box with the ID. Example code to display only one info box per Feature at a time.
######FilterGoogleMapsPlaces
Fetches, for the viewport bounds, and specified place types, places from Google's API, using the PHP script discussed bellow. Requires the boundingBox and place_types fields.
Example styling code is present, this filter makes use of the icon defined by Google (after resizing it as needed) if present, and it will display a info box on hover, one total per map at a time.

###Data Sources
The MapQuery library uses GeoJSON as a medium to collate the geographical information, combined with Google Maps API to provide display and user interface features.
In future development, any kind of storage that supports or can be used to generate GeoJSON features as per the spec, could be used. The tool chosen for the example project was postgresql server running PostGIS.
PostGIS supports native queries returned as GeoJSON, and useful geographical based queries, that provide much needed performance, particularity for large data sets.
External APIs can be cached in the server database, not cached but routed through a API developed using PHP, node.js or similar, or connected directly to the JS client.
It is also possible to simply store static data sets on the server as a .json file, then loading it using AJAX queries.

####PostGIS Environment
Consider this "self study"; there are multiple, fairly complex requirements for successfully setting up a PostGIS environment. Debian, Ubuntu or similar is recommended. Requires a intermediate connector, such as PHP's db driver.
Once the environment and users are set up, then `psql_dump.txt` can be imported with the command `psql dbname < psql_dump.txt`. This dump contains all the data and tables used for this example.

####The PHP API
#####php/google_maps_places.php
This script contains a function for the implementation of web based places query using the Google Maps Places API. Requires a valid API key.
#####filters/
######`GET` filter_qld_aus_localities.php
Data from the data.gov.au site, for all localities in QLD, Aus, was imported into the database using QGIS, from a shape file.
Using viewport bounds, all localities that are partially included in the view are found, and returned, with PostGIS powered queries.
Data is returned as a json but not formatted to conform to the GeoJSON spec, that is handled in the JS filter definition.

[The source data for this can be found here](https://www.data.gov.au/dataset/qld-suburb-locality-boundaries-psma-administrative-boundaries)

######`GET` filter_google_maps_places.php
Data is fetched from the Google Maps Places API. The bounding box is converted to a point and radius that covers the entire viewport, using the Haversine formula.
Place data is cached in the database, and queried. Returns a JSON, GeoJSON spec is handled by the JS filter definition.
There are legal requirements for using this copyrighted data, see the legal section.

##Further Development
I will probably not take development of this project any further. Support of rasters, using overlays and approximate latitude to pixel calculations, and other cool features, would be excellent additions to this library.
The actual interface with the Google Map could use re-factoring, and some pair programming evaluation of the underlying library would not go astray. A UIX skilled developer with more time then I could also work on generating queries.
Finally, I considered, and designed for, but never wrote, filters that would cache results client side. This is more of a UIX and performance advantage, but would be valuable if using this library for production.

##Legal
This software uses Google's APIs, and is subject to the licence agreements and ToS inherent therein. Of particular note should be the limitations on the places API: strict limitations are placed on caching, and at the time of writing the absolute top time limit that data is allowed to be kept is 30 days. No responsibility for violation of any ToS, licence agreements, or similar requirements, by any user, direct or indirect, is taken by the author.

This software is covered by the following Licence:

This is free and unencumbered software released into the public domain.

As the author, I, Joseph Cumines, do ask you notify me if you use this
software or find it useful, however this is not required.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.