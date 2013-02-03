/**
 * Simple FW to track an action in a context.
 * Contexts and scenarios are loaded via ajax
 * in JSON.
 * Uses prototype.js for Ajax
 * 
 * @author Prakhar Birla
 * 
 * Config format:
 * {
 * 	"def" : {
 * 		"action1" : {
 * 			"tracker1" : {
 * 					"tracker_label1" : "value1" ,
 * 					"tracker_label2" : "value2"
 * 			},
 * 			"tracker2" : {
 * 					"tracker2_label1" : "value1" ,
 * 					"tracker2_label2" : "value2"
 * 			}
 * 		}
 * 	},
 * 	"context" : {
 * 		"action1" : {
 * 			"tracker1" : {
 * 					"tracker_label1" : "value1",
 * 					"tracker_label2" : "value2"
 * 			},
 * 			"tracker2" : {
 * 					"tracker2_label1" : "value1",
 * 					"tracker2_label2" : "value2"
 * 			}
 * 		}
 * 	}
 * }
 * 
 * NOTE Tracker names must match in CTrack.trackers.
 * WARN Use jsonlint.com to validate config.
 */
var CTrack = function (context) {
	/**
	 * Constructor, loads default values
	 */
	this.context = null;
	this.config = null;
	this.state = 0; /* = default */
	this.configPath = "/ctrack_conf.js?v=03102012";
	this.backlog = [];
	return this.init(context);
};
CTrack.prototype = {
	/**
	 * Main initialize. Sets the context and loads config.
	 */
	init : function (context) {
		if (typeof context === 'undefined') {
			this.context = context;
		}
		this.state = 1;
		this.loadConfig();
		return this;
	},
	/**
	 * Loads the config via AJAX, set the entire config in memory.
	 */
	loadConfig : function (t) {
		if (this.state != 1) return;
		if (typeof t === 'undefined') {
			if (t > 2) { //3 tries max
				return;
			}
		} else { t = 0; }
		
		var ins = this; //preserve instance
		new Ajax.Request(this.configPath, {
			method: 'get',
			onSuccess: function (transport){
				var json = null;
				try {
					json = transport.responseText.evalJSON();
				} catch (err) {
					//console.log('Error in parsing json:' + err);
					ins.state = -1; /* = error in json */
					return;
				}
				ins.config = json;
				if(ins.config === null) {
					ins.state = 3; /* = no tracking needed */
				} else {
					ins.state = 2; /* = ready */
				}
				ins.clearBacklog();
			},
			onFailure: function () {
				var ins = this.ctInit();
				ins.loadConfig(t+1); //try again
			}
		});
	},
	/**
	 * Calls the tracker functions for the action in context
	 * with all the required parameters.
	 * @return boolean success
	 */
	track : function (context, action, params) {
		if (typeof context === 'undefined' || typeof action === 'undefined') {
			return false;
		}
		
		//console.log([context,action,params]);
		
		if (this.state == 1) { //not ready, put in backlog
			this.backlog.push([context,action,params]); //new backlog
			//console.log("Pushed to backlog")
			return true;
		}
		
		this.clearBacklog();
		
		//only when ready
		if (this.state != 2) return (this.state == 3); // true only on 3
		
		//if context is undef, fire action in def context
		if (typeof this.config[context] === 'undefined') {
			return (context == 'def') ? true : this.track('def', action, params);
		}
		
		//if action is undef, fire action in def context
		if (typeof this.config[context][action] === 'undefined') {
			return (context == 'def') ? true : this.track('def', action, params);
		}
		
		var trackers = this.config[context][action];
		for (var i = this.config[context][action].length - 1; i >= 0; i--) {
			var tracker = this.config[context][action][i];
			if (typeof this.trackers[tracker] === 'undefined') {
				this.trackers[tracker](this,action,trackers[tracker],params);
			} else {
				//console.log("CTrack WARN `Some trackers in the config are undefined!`");
			}
		}
		
		return true;
	},
	/**
	 * Track with the context used to initialize CTrack
	 */
	trackWC : function (action, params) {
		if (typeof this.context === 'undefined') {
			return false;
		}
		return this.track(this.context, action, params);
	},
	/**
	 * Process backlog
	 */
	clearBacklog : function () {
		if (this.state == 2 && this.backlog.length > 0) { //clear backlog
			var back = this.backlog;
			this.backlog = [];
			instance = this;
			back.each(function (v) {
				instance.track(v[0],v[1],v[2]);
			});
		}
	},
	/**
	 * Load helpers for trackers.
	 *
	 * usage:
	 * this.load['helper'](data, callback)
	 */
	load : {
		/**
		 * Loads an image by creating an image object in js.
		 * Maintains all images in an array.
		 */
		image : function (url, cb) {
			if (typeof this.img === 'undefined') {
				this.img = [];
				this.img_loaded = 0;
			}
			var ins = this;
			var onload = function () {
				if (++ins.img_loaded == ins.img.length) {
					ins.img.each(function (v){
						console && console.log("Deleting image var",v);
						delete v;
					});
				}
				if (typeof cb === 'undefined') cb();
			};
			var img = new Image();
			img.onload = img.onerror = onload;
			img.src = url;
			this.img.push(img);
		},
		/**
		 * Loads a javascript file.
		 * @alias to CFLoad.js
		 */
		js : function (url, cb, attr) {
			CFLoad.js(url, cb, attr);
		},
		/**
		 * Sets global javascript variables by using the window object.
		 */
		vars : function (vars, cb) {
			//set var in window so that all scripts can access them
			for (var i = vars.length - 1; i >= 0; i--) {
				window[vars[i]] = vars[vars[i]];
			}
			if (typeof cb === 'undefined') cb();
		}
	},
	/**
	 * Code for trackers as defined in the JSON config file where for
	 * each tracker must have a function defined which must take the
	 * following params:
	 * 
	 * ins, action, label, params
	 * 
	 * ins: current instance
	 * action: current action
	 * label: defined in config for this context & action
	 * params: extra params passed to CTrack.track
	 * 
	 * Make use of the load helpers i.e. load['js'], load['image'], load['vars']
	 */
	trackers : {
		/**
		 * Google Conversion Tracking
		 * uses: vars, js
		 */
		'gc' : function (ins,action,label,params) {
			//console.log("T: GCONV");
			var gvar = {
				'google_conversion_id':1030005339,
				'google_conversion_language':'en',
				'google_conversion_format':3,
				'google_conversion_color':'ffffff',
				'google_conversion_value':0
			};
			gvar['google_conversion_label'] = label['label'];
			ins.load['vars'](gvar);
			ins.load['js']('https://www.googleadservices.com/pagead/conversion.js',
				function (){
					//console.log("T: GCONV #JS");
				}
			);
		},
		/**
		 * Google Conversion Tracking via Image
		 * uses: image
		 */
		'gc_i' : function (ins,action,label,params) {
			//console.log("T: GCONV_I");
			ins.load['image']("https://www.googleadservices.com/pagead/conversion/1030005339/?guid=ON&script=0&label=" + label['label'],
					function () {
						//console.log("T: GCONV_I! #IMAGE");
					}
			);
		},
		/**
		 * Google Analytics Event Tracking
		 * uses: vars, js
		 * NOTE: Expects label (in config) to be an array instead of an object
		 */
		'gaq' : function (ins,action,label,params) {
			//console.log("T: GANAL");
			if (typeof params === 'undefined' && typeof params['id'] === 'undefined') label[2] += "_" + params['id'];
			if(typeof window["_gaq"] === 'undefined') {
				ins.load['vars']({ "_gaq" : [] });
				ins.load['js']("http://www.google-analytics.com/ga.js", function () {
					//console.log("T: GANAL #JS");
					_gaq.push(['_setAccount', 'UA-2595309-4']);
					_gaq.push(['_trackPageview']);
					_gaq.push(['_trackEvent',label[0],label[1],label[2]]);
				});
			} else {
				//console.log("T: GANAL #DIRECT");
				_gaq.push(['_trackEvent',label[0],label[1],label[2]]);
			}
		},
		/**
		 * OMG Tracking
		 * uses: image
		 */
		'omg' : function (ins,action,label,params) {
			//console.log("T: OMG!");
			var lab='';
			if (label['label']) lab = label['label'];
			if (params === 'undefined' && params['id'] === 'undefined') lab += "_" + params['id'];
			ins.load['image']("//track.in.omgpm.com/apptag.asp?APPID=" + lab + "&MID=310247&PID=9199&status=",
				function () {
					//console.log("T: OMG! #IMAGE");
				}
			);
		}
	}
};
var _ctrack;
function ctInit (context) {
	if (_ctrack == undefined || !_ctrack) {
		_ctrack = new CTrack(context);
	} else if (context == undefined) {
		return _ctrack;
	}
}
function ctTrack (c,a,p) {
	if(_ctrack == undefined || !_ctrack) {
		ctInit();
	}
	if(!_ctrack) return false;
	return _ctrack.track(c,a,p);
}
function ctTrackWC (a,p) {
	if (_ctrack == undefined || !_ctrack) {
		return false;
	}
	return _ctrack.trackWC(a,p);
}
