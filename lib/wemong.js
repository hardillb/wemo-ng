
var SSDP    = require('node-ssdp').Client;
var request = require('request');
var xml2js = require('xml2js');
var url     = require('url');
var http = require('http');
var util = require('util');

var postbodyheader = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">',
    '<s:Body>'].join('\n');


var postbodyfooter = ['</s:Body>',
  '</s:Envelope>'
].join('\n');

var getenddevs = {};
getenddevs.path = '/upnp/control/bridge1';
getenddevs.action = '"urn:Belkin:service:bridge:1#GetEndDevices"';
getenddevs.body = [
  postbodyheader, 
  '<u:GetEndDevices xmlns:u="urn:Belkin:service:bridge:1">', 
  '<DevUDN>%s</DevUDN>', 
  '<ReqListType>PAIRED_LIST</ReqListType>',
  '</u:GetEndDevices>',
  postbodyfooter
].join('\n');

var WEMO_BRIDGE = function() {

}

WEMO_BRIDGE.TYPE ="urn:Belkin:device:bridge:1";

var WEMO_SOCKET = function () {
	
}

WEMO_SOCKET.TYPE ="";

var WEMONG = function() {
	this.device_list = [];
	this.device_name = {};
	this.discover();
	setTimeout(this.stop.bind(this), 5000);
};

WEMONG.ST = 'urn:Belkin:service:basicevent:1';

WEMONG.prototype = {
	discover: function () {
		this._ssdp_client = new SSDP();
		this._ssdp_client.setMaxListeners(0);
		var devList = this.device_list;
		var names = this.device_name;
		this._ssdp_client.on('response', function(msg, status, rinfo){
			if (msg.ST === WEMONG.ST) {
				var loc = url.parse(msg.LOCATION);
				request.get(loc.href, function(err, res, xml) {
					if (!err) {
						xml2js.parseString(xml, function(err, json) {
							if (!err) {
								var device = {ip: loc.hostname, port: loc.port};
								for (var key in json.root.device[0]) {
									device[key] = json.root.device[0][key][0];
								}
								if (device.deviceType === WEMO_BRIDGE.TYPE) {
									var postoptions = {
										host: device.ip,
										port: device.port,
										path: getenddevs.path,
										method: 'POST',
										headers: {
									 		'SOAPACTION': getenddevs.action,
									 		'Content-Type': 'text/xml; charset="utf-8"',
											'Accept': ''
										}
									};

									var post_request = http.request(postoptions, function(res) {
									var data = "";
									res.setEncoding('utf8');
									res.on('data', function(chunk) {
										data += chunk;
									});

									res.on('end', function(){
										xml2js.parseString(data, function(err, result) {
											if (!err) {
												//console.log("%j",result);
												var list = result["s:Envelope"]["s:Body"][0]["u:GetEndDevicesResponse"][0].DeviceLists[0];
												xml2js.parseString(list, function(err, result2) {
													if (!err) {
														var devinfo = result2.DeviceLists.DeviceList[0].DeviceInfos[0].DeviceInfo;
														if (devinfo) {
															for (var i=0; i<devinfo.length; i++) {
																//console.log("%s[%s]:\t\t%s",devinfo[i].FriendlyName[0], devinfo[i].DeviceID[0], devinfo[i].CurrentState[0]);
																var light = {
																	"ip": device.ip,
																	"port": device.port,
																	"udn": device.UDN,
																	"name": devinfo[i].FriendlyName[0],
																	"id": devinfo[i].DeviceID[0],
																	//"state": devinfo[i].CurrentState[0] ,
																	"bridge": device
																};
																devList.push(light);
																names[light.name] = light;
															}
														}
														var groupinfo = result2.DeviceLists.DeviceList[0].GroupInfos;
														if (groupinfo) {
															//group found
															console.log("Groups are currently nots supported");
														}
													} else {
														console.log(err);
														console.log(data);
													}
												});
											}
										});
									  });
									});
									post_request.write(util.format(getenddevs.body, device.UDN));
									post_request.end();


								} else if ( device.deviceType === 'urn:Belkin:device:controllee:1') {
									devList.push(device);
									names[device.friendlyName] = device;
								}
								
							}
						});
					} else {
						console.log("err %j", err);
						console.log("res %s", res);
						console.log("xml %s", xml);
					}
				});
			}
		});

		this._ssdp_client.search(WEMONG.ST);
	},
	stop: function() {
		if (this._ssdp_client) {
			this._ssdp_client._stop();
		}
	},
	getDevices: function() {
		return this.device_list;
	},
	getNames: function() {
		return Object.keys(this.device_name);
	},
	getType: function(name) {
		return "";
	}

}

module.exports = WEMONG;