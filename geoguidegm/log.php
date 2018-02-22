<?php
header('Access-Control-Allow-Origin: *');

$uuid = $_REQUEST['uuid'];
$t = $_REQUEST['t'];
$d = $_REQUEST['data'];
$ip = $_SERVER['REMOTE_ADDR'];

date_default_timezone_set("Europe/Zurich");

$db = new PDO("mysql:host=localhost;dbname=geoguide", 'geoguide', '');
$stmt = $db->prepare("INSERT INTO geoguide_log (t, ip, dt, uuid, data) VALUES (:t, :ip, :dt, :uuid, :data)");
$stmt->bindParam(':t', $t);
$stmt->bindParam(':ip', $ip);
$stmt->bindParam(':dt', date("Y-m-d H:i:s"));
$stmt->bindParam(':uuid', $uuid);
$stmt->bindParam(':data', $d);
$stmt->execute();

print 'success';
?>
