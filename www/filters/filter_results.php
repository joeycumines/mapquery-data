<?php
	/*
		Simple functions for standardizing error messages.
		
		This entire library should really be done in something like node.js.
	*/
	
	$statusField = 'status';
	$resultField = 'result';
	
	function filter_result($status, $result) {
		global $statusField, $resultField;
		$json = array($statusField=>$status, $resultField=>$result);
		return json_encode($json);
	}
	
	function filter_success($resultJSON) {
		return filter_result('success', $resultJSON);
	}
	
	function filter_error($message) {
		return filter_result('error', $message);
	}
	
	function filter_failure($message) {
		return filter_result('failure', $message);
	}
?>