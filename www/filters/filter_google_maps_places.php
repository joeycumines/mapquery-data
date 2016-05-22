<?php
	/*
		This is a wrapper for both google maps places queries and postgis queries, to support server side caching of data.
		
		GET this page.
		
		Parameters:
		- topLeftLat
		- topLeftLng
		- bottomRightLat
		- bottomRightLng
		- type
			- This is a single google maps places api type
			- https://developers.google.com/places/supported_types#table1
		
		result format:
			- Array of rows from the database table 
	*/
	
	/**
	 * CREDIT: http://stackoverflow.com/a/10054282
	 * Calculates the great-circle distance between two points, with
	 * the Haversine formula.
	 * @param float $latitudeFrom Latitude of start point in [deg decimal]
	 * @param float $longitudeFrom Longitude of start point in [deg decimal]
	 * @param float $latitudeTo Latitude of target point in [deg decimal]
	 * @param float $longitudeTo Longitude of target point in [deg decimal]
	 * @param float $earthRadius Mean earth radius in [m]
	 * @return float Distance between points in [m] (same as earthRadius)
	 */
	function haversineGreatCircleDistance(
	  $latitudeFrom, $longitudeFrom, $latitudeTo, $longitudeTo, $earthRadius = 6371000)
	{
	  // convert from degrees to radians
	  $latFrom = deg2rad($latitudeFrom);
	  $lonFrom = deg2rad($longitudeFrom);
	  $latTo = deg2rad($latitudeTo);
	  $lonTo = deg2rad($longitudeTo);

	  $latDelta = $latTo - $latFrom;
	  $lonDelta = $lonTo - $lonFrom;

	  $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
		cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));
	  return $angle * $earthRadius;
	}
	
	require('../php/db_connection.php');
	require('../php/google_maps_places.php');
	require('filter_results.php');
	
	//parse params.
	$topLeftLat = validate(isset($_GET['topLeftLat']) ? $_GET['topLeftLat'] : null);
	$topLeftLng = validate(isset($_GET['topLeftLng']) ? $_GET['topLeftLng'] : null);
	$bottomRightLat = validate(isset($_GET['bottomRightLat']) ? $_GET['bottomRightLat'] : null);
	$bottomRightLng = validate(isset($_GET['bottomRightLng']) ? $_GET['bottomRightLng'] : null);
	
	$type = validate(isset($_GET['type']) ? $_GET['type'] : null);
	
	if ($topLeftLat == null || $topLeftLng == null || $bottomRightLat == null || $bottomRightLng == null || $type == null) {
		echo(filter_failure('Invalid parameters, did not attempt.'));
		die();
	}
	
	//convert our input bounding box into a centre point + radius.
	$radius = haversineGreatCircleDistance($topLeftLat, $topLeftLng, $bottomRightLat, $bottomRightLng);
	$temp = haversineGreatCircleDistance($topLeftLat, $bottomRightLng, $bottomRightLat, $topLeftLng);
	if ($temp > $radius)
		$radius = $temp;
	
	$smaller = $topLeftLat;
	$larger = $bottomRightLat;
	if ($smaller > $larger) {
		$temp = $smaller;
		$smaller = $larger;
		$larger = $temp;
	}
	$lat = ($larger - $smaller)/2.0 + $smaller;
	
	$smaller = $topLeftLng;
	$larger = $bottomRightLng;
	if ($smaller > $larger) {
		$temp = $smaller;
		$smaller = $larger;
		$larger = $temp;
	}
	$lng = ($larger - $smaller)/2.0 + $smaller;
	
	//our param query
	$params = array('type'=>$type);
	
	//fetch from google.
	$response = maps_nearbySearch($lat, $lng, $radius, $params);
	
	if ($response == null) {
		//we had a bad query
		echo(filter_failure('Our query failed.'));
		die();
	}
	
	if (!isset($response['status']) || $response['status'] == 'REQUEST_DENIED' || $response['status'] == 'INVALID_REQUEST') {
		//there were no results, and due to a bad query.
		echo(filter_failure('We had bad response. '.json_encode($response)));
		die();
	}
	
	$dbCon = getNewDbCon();
	
	if ($response['status'] == 'OK' && isset($response['results'])) {
		//we have a good response, and theoretically have some results to store in the db.
		//we can continue with no results, if we are over our quota for example, but we can't add to the db
		foreach ($response['results'] as $result) {
			//extract google id from result.
			$googleId = isset($result['id']) ? $result['id'] : null;
			//extract the lat and lng values to floats
			$lat = isset($result['geometry']) && isset($result['geometry']['location'])
					&& isset($result['geometry']['location']['lat']) ? floatval($result['geometry']['location']['lat']) : null;
			$lng = isset($result['geometry']) && isset($result['geometry']['location'])
					&& isset($result['geometry']['location']['lng']) ? floatval($result['geometry']['location']['lng']) : null;
			
			//if we didn't have the required fields we don't add
			if ($googleId == null || $lat == null || $lng == null)
				continue;
			
			//create the subquery for loading our geometry.
			$geomSub = '(SELECT ST_SetSRID(ST_GeomFromText(\'POINT('.$lng.' '.$lat.')\'),4326))';
			$jsonEscaped = json_encode($result);
			
			//attempt to create a database row for this response.
			try {
				//delete existing row for this.
				$sql = 'DELETE FROM google_maps_places WHERE google_id = $1;';
				$resource = pg_query_params($dbCon, $sql, array($googleId));
				if ($resource == false) {
					echo(filter_error(pg_last_error()));
					die();
				}
				
				$sql = 'INSERT INTO google_maps_places (geom, type, json_result, google_id) VALUES ('.
						$geomSub.' ,$1, $2, $3);';
				$resource = pg_query_params($dbCon, $sql, array($type, $jsonEscaped, $googleId));
				if ($resource == false) {
					echo(filter_error(pg_last_error()));
					die();
				}
			} catch (Expection $e) {
				echo(filter_failure('We failed to use the database properly. '.$e->getMessage()));
				die();
			}
		}
	}
	
	//now, we need to query the database.
	
	$boundingBox = getBoundingBox($topLeftLat, $topLeftLng, $bottomRightLat, $bottomRightLng);
	//Our query string
	
	//if the point for the place is contained in the bounding box, and the type is equal.
	$query = 'SELECT ST_AsGeoJSON(ST_SetSRID(geom, 4326)) AS geojson, json_result, added_ts
	FROM google_maps_places
	WHERE type = $1 AND (SELECT ST_Contains('.$boundingBox.', ST_SetSRID(google_maps_places.geom, 4326))) = TRUE;';
	
	//$query = 'SELECT ST_AsGeoJSON(ST_SetSRID('.$boundingBox.', 4326)) AS geojson;';
	
	$resource = pg_query_params($dbCon, $query, array($type));
	if ($resource == false) {
		echo(filter_error(pg_last_error()));
		die();
	}
	
	$result = null;
	//now we have a result
	$numRows = pg_numrows($resource);
	for ($x = 0; $x < $numRows; $x++) {
		$row = array();
		//add to result.
		//Load into object for conversion to json.
		$row['geojson'] = json_decode(pg_fetch_result($resource, $x, 'geojson'), true);
		$row['google_data'] = json_decode(pg_fetch_result($resource, $x, 'json_result'), true);
		$row['added_ts'] = pg_fetch_result($resource, $x, 'added_ts');
		
		//add to result
		if ($result == null)
			$result = array();
		
		array_push($result, $row);
	}
	
	if ($result == null || empty($result)) {
		echo(filter_error('The result was null!'));
		die();
	}
	
	//Reformat result into an array of geojson Features.
	$temp = array();
	foreach ($result as $row) {
		$feature = array();
		$feature['type'] = 'Feature';
		$feature['properties'] = array();
		$feature['geometry'] = $row['geojson'];
		foreach ($row as $key=>$value) {
			if ($key != 'geojson') {
				$feature['properties'][$key] = $value;
			}
		}
		//add to temp
		array_push($temp, $feature);
	}
	
	echo(filter_success($temp));
?>