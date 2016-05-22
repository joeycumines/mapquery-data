<?php
	/*
		This is a simple interface for the places web api.
		
		It might be more efficient to use curl, since it is unknown if the default php lib will
		open a new https connection every request.
	*/
	
	/**
		Google Places web API key.
	*/
	$GOOGLE_API_KEY = '<api_key_here>';
	
	/**
		Makes a radar search query to google.
		
		Returns null if we failed to validate, else the response from google as json.
		If we had an error, then we return null.
		
		$radius:
			- In meters
		$params:
			- A string key-pair object
			- A Radar Search request must include at least one of keyword, name, or type.
			- if !isset any of these then we return null
	*/
	function maps_nearbySearch($lat, $lng, $radius, $params, $nextPageToken = null) {
		global $GOOGLE_API_KEY;
		/**
			Max search radius defined by the api, in meters.
		*/
		$maxRadius = 50000;
		
		$radius = intval($radius);
		if ($radius > $maxRadius)
			$radius = $maxRadius;
		if ($radius < 1)
			$radius = 1;
		
		$url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?key='.$GOOGLE_API_KEY;
		$url .= '&location='.floatval($lat).','.floatval($lng);
		$url .= '&radius='.$radius;
		
		//validate the input
		$hadAny = false;
		if (isset($params['keyword'])){
			$url .= '&keyword='.$params['keyword'];
			$hadAny = true;
		}
		if (isset($params['name'])){
			$url .= '&name='.$params['name'];
			$hadAny = true;
		}
		if (isset($params['type'])){
			$url .= '&type='.$params['type'];
			$hadAny = true;
		}
		if (!$hadAny)
			return null;
		
		//set the next page token.
		if ($nextPageToken != null)
			$url .= '&pagetoken='.$nextPageToken;
		
		$response = null;
		
		//now we can try to query the api.
		try {
			$response = json_decode(file_get_contents($url), true);
		} catch (Exception $e) {
			return null;
		}
		if ($response == null)
			return null;
		
		//if our status was not ok, then return here.
		if (!isset($response['status']) || $response['status'] != 'OK') {
			return $response;
		}
		
		//if we have additional pages that we need to get, then we fetch them recursively.
		if (isset($response['next_page_token']) && $response['next_page_token'] != null) {
			//we have a next_page_token, so lets fetch for that
			$nextResponse = maps_nearbySearch($lat, $lng, $radius, $params, $response['next_page_token']);
			if ($nextResponse != null && $nextResponse['status'] == 'OK') {
				//we got a not null and ok next response
				//add the results to this one.
				$response['results'] = array_merge($response['results'], $nextResponse['results']);
			}
		}
		
		//return response
		return $response;
	}
?>