<?php
	//This was personal preference, matches the db server time in this case.
	date_default_timezone_set("Australia/Brisbane");
	
	//declare db connection globals
	//YOU WILL NEED TO ENTER YOUR DATABASE DETAILS
	$DB_CONNECTION_STRING = 'host=<hostname> dbname=project1 user=<username> password=<password>';
	
	function getNewDbCon() {
		global $DB_CONNECTION_STRING;
		return pg_connect($DB_CONNECTION_STRING);
	}
	
	/**
		A generic helper method to validate input from untrusted source.
		Strips special characters, escapes html and slashes, and trims the text.
		If there is no data it will return null for easy comparison.
	*/
	function validate($data) {
		$data = trim($data);
		$data = stripslashes($data);
		$data = htmlspecialchars($data);
		
		//empty string or variable results in null, for easy comparison
		if (empty($data))
			return null;
		
		return $data;
	}
	
	/**
	*/
	function getBoundingBox($topLeftLat, $topLeftLng, $bottomRightLat, $bottomRightLng) {
		$topLeftLat = floatval($topLeftLat);
		$topLeftLng = floatval($topLeftLng);
		$bottomRightLat = floatval($bottomRightLat);
		$bottomRightLng = floatval($bottomRightLng);
		
		//we do this with casting because we can't work inside a prepared statement.
		$polygonMake = '(SELECT ST_SetSRID(ST_GeomFromText(\'POLYGON(('
		.$topLeftLng.' '.$topLeftLat
		.', '.$topLeftLng.' '.$bottomRightLat
		.', '.$bottomRightLng.' '.$bottomRightLat
		.', '.$bottomRightLng.' '.$topLeftLat
		.', '.$topLeftLng.' '.$topLeftLat.'))\'), 4326))';
		return $polygonMake;
	}
?>