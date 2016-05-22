<?php
	/*
		Using a simple get request, we can get the localities that overlap with or are included in
		a bounding box.
		
		Parameters:
		- topLeftLat
		- topLeftLng
		- bottomRightLat
		- bottomRightLng
		
		result format:
		- array of results (rows) from db in a json object
	*/
	
	require('../php/db_connection.php');
	require('filter_results.php');
	
	//attempt to load our parameters, if we can't get them we exit with fail.
	
	$topLeftLat = validate(isset($_GET['topLeftLat']) ? $_GET['topLeftLat'] : null);
	$topLeftLng = validate(isset($_GET['topLeftLng']) ? $_GET['topLeftLng'] : null);
	$bottomRightLat = validate(isset($_GET['bottomRightLat']) ? $_GET['bottomRightLat'] : null);
	$bottomRightLng = validate(isset($_GET['bottomRightLng']) ? $_GET['bottomRightLng'] : null);
	$insolvency = isset($_GET['insolvency']) && $_GET['insolvency'] == 'true' ? true : false;
	
	if ($topLeftLat == null || $topLeftLng == null || $bottomRightLat == null || $bottomRightLng == null) {
		echo(filter_failure('Invalid parameters, did not attempt.'));
		die();
	}
	
	$dbCon = getNewDbCon();
	
	$boundingBox = getBoundingBox($topLeftLat, $topLeftLng, $bottomRightLat, $bottomRightLng);
	//Our query string
	//if we overlap, or we contain the suburb, or we are contained in the suburb
	$query = 'SELECT ST_AsGeoJSON(ST_SetSRID(geom, 4326)) AS geojson, id, lc_ply_pid, dt_create, dt_retire, loc_pid, 
	qld_locali, qld_loca_1, qld_loca_2, qld_loca_3, qld_loca_4, qld_loca_5, qld_loca_6, qld_loca_7 FROM qld_suburb_boundaries WHERE (SELECT
	ST_Overlaps(ST_SetSRID(qld_suburb_boundaries.geom, 4326), '.$boundingBox.')) = TRUE
	OR (SELECT ST_Contains('.$boundingBox.', ST_SetSRID(qld_suburb_boundaries.geom, 4326))) = TRUE
	OR (SELECT ST_Contains(ST_SetSRID(qld_suburb_boundaries.geom, 4326), '.$boundingBox.')) = TRUE ;';
	
	//$query = 'SELECT ST_AsGeoJSON(ST_SetSRID('.$boundingBox.', 4326)) AS geojson;';
	
	$resource = pg_query_params($dbCon, $query, array());
	if ($resource == false) {
		echo(filter_error(pg_last_error()));
		die();
	}
	
	$result = null;
	//now we have a result
	$numRows = pg_numrows($resource);
	for ($x = 0; $x < $numRows; $x++) {
		$field = pg_fetch_result($resource, $x, 'id');
		if ($field == false)
			break;
		
		$row = array();
		//add to result.
		//Load into object for conversion to json.
		$row['geojson'] = json_decode(pg_fetch_result($resource, $x, 'geojson'), true);
		$row['id'] = pg_fetch_result($resource, $x, 'id');
		$row['lc_ply_pid'] = pg_fetch_result($resource, $x, 'lc_ply_pid');
		$row['dt_create'] = pg_fetch_result($resource, $x, 'dt_create');
		$row['dt_retire'] = pg_fetch_result($resource, $x, 'dt_retire');
		$row['loc_pid'] = pg_fetch_result($resource, $x, 'loc_pid');
		$row['qld_locali'] = pg_fetch_result($resource, $x, 'qld_locali');
		$row['qld_loca_1'] = pg_fetch_result($resource, $x, 'qld_loca_1');
		$row['qld_loca_2'] = pg_fetch_result($resource, $x, 'qld_loca_2');
		$row['qld_loca_3'] = pg_fetch_result($resource, $x, 'qld_loca_3');
		$row['qld_loca_4'] = pg_fetch_result($resource, $x, 'qld_loca_4');
		$row['qld_loca_5'] = pg_fetch_result($resource, $x, 'qld_loca_5');
		$row['qld_loca_6'] = pg_fetch_result($resource, $x, 'qld_loca_6');
		$row['qld_loca_7'] = pg_fetch_result($resource, $x, 'qld_loca_7');
		
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