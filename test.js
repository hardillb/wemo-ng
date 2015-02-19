var wemong = require('./index.js');

var wemo = new wemong();

//wemo.discover();

setTimeout(function(){
	console.log("%j", wemo.getNames());
}, 2000);