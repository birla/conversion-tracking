(function(w) {
	w.ctrack = (function () {
		'use strict';

		//private
		var _context,
			_config,
			_state = 1,
			_configPath,
			_backlog = [],
			_aps = Array.prototype.slice,
			_img_tags = [],
			_img_loaded = 0,
			_trackers = {},

			_log = w.debug //using Bel Alman's debug.js
			// _ef = function(){},
			// _log = {
				// setLevel: _ef,
				// log: _ef,
				// debug: _ef,
				// group: _ef,
				// groupEnd: _ef,
				// warn: _ef,
				// error: _ef
			// }
			;

		_log.setLevel(4);

		/* helpers */
		function is_undef(val) {
			return typeof val === 'undefined';
		}

		function is_nun(val) {
			return typeof val === 'undefined' || val === null;
		}

		function is_func(val) {
			return typeof val === 'function';
		}

		function loadConfig(config) {
			//TODO: config sanity checks
			if(is_nun(config)) return false;
			_config = config;
			_state = 2;
			clearBacklog();
		}

		function configPathExists() {
			var len = arguments.length, i = 0, verdict = true, path = _config;
			_log.log("Config:", path);

			while(i < len && verdict) {
				path = path[arguments[i]];
				_log.log("Arg:",arguments[i]);
				_log.log("Path:", path);
				verdict &= !is_undef(path);
				i++;
			}

			return verdict;
		}

		function clearBacklog() {
			if(_backlog.length > 0 && _state === 2) {
				_log.debug('ctrack: Clearing backlog');
				var backlog = _backlog;
				_backlog = [];
				for (var i = 0, len = backlog.length; i < len; i++) {
					switch(backlog[i][0]) {
						case 0:
							track.apply(w.ctrack, backlog[i][1]);
							break;
					}
				}
			}
		}

		function track(context, action, params) {
			_log.group('ctrack');
			_log.log('Entering ctrack');

			var status = false;

			do {
				if(is_undef(context) || is_undef(action)) {
					_log.debug('ctrack: Either context or action is undefined');
					break;
				}

				if(_state === 1) {
					_backlog.push([0,_aps.call(arguments)]);
					_log.warn('ctrack: Pushed to log as we are not ready');
					status = true;
					break;
				}

				clearBacklog();

				//only when ready
				if(_state !== 2){
					status = (_state === 3); // true only on 3
					break;
				}

				if(!configPathExists(context, action)) {
					if(context !== 'def' && configPathExists('def', action)) {
						_log.debug('ctrack: Path exists via default context in config');
						context = 'def';
					} else {
						_log.debug('ctrack: Path does not exist in config');
						break;
					}
				} else {
					_log.log('ctrack: Path exists in config');
				}

				var trackers = _config[context][action];
				for(var key in trackers) {
					if (trackers.hasOwnProperty(key)) {
						_log.log('ctrack: Trying tracker', key);
						if (!is_undef(_trackers[key])) {
							_trackers[key](action,trackers[key],params);
							_log.debug('ctrack: Tracked!', key);
						} else {
							_log.warn('ctrack: WARN `Some trackers in the config are undefined!`');
						}
					}
				}
			} while(false);

			_log.log('ctrack: Complete');
			_log.groupEnd();
			return status;
		}

		function addTrackers(trackers, force) {
			var bind;
			if(is_undef(force)) force = false;

			for(var key in trackers) {
				if (trackers.hasOwnProperty(key)) {
					// if(is_func)
					bind = false;
					if(_trackers.hasOwnProperty(key)) {
						if(force)	bind = true;
					} else {
						bind = true;
					}
					if(bind) {
						_trackers[key] = trackers[key];
						_log.debug('ctrack: Adding tracker', key);
					} else {
						_log.warn('ctrack: WARN Use force to override an existing tracker');
					}
				}
			}
		}

		/**
		 * Load helpers for trackers.
		 *
		 * usage:
		 * load['helper'](data, callback)
		 */
		
		var _fScript = document.getElementsByTagName( "script" )[ 0 ];
		function isFileReady( v ) {
			return ( ! v || v == "loaded" || v == "complete" || v == "uninitialized" );
		}

		var loadHelpers = {
			/**
			 * Loads an image by creating an image object in js.
			 * Maintains all images in an array.
			 */
			image : function (url, cb) {
				if (typeof _img_tags === 'undefined') {
					_img_tags = [];
					_img_loaded = 0;
				}
				var onload = function () {
					if (++_img_loaded == _img_tags.length) {
						for (var i = _img_loaded - 1; i >= 0; i--) {
							_log.log("Deleting image var",_img_tags[i]);
							delete _img_tags[i];
						}
					}
					if (typeof cb === 'undefined') cb();
				};
				var img = new Image();
				img.onload = img.onerror = onload;
				img.src = url;
				_img_tags.push(img);
			},
			/**
			 * Loads a javascript file.
			 * @param string src URL of the Script to be loaded
			 * @param [function cb] Callback function defined as (scriptTag, failed)
			 * @param [int timeout] Timeout until we give up, def 5000
			 */
			js : function(src,cb,timeout) {
				var s = document.createElement( "script" ),
					done, i;
				s.src = src;
				s.type = "text/javascript";
				
				s.onreadystatechange = s.onload = function () {
					if ( ! done && isFileReady( s.readyState ) ) {
						done = 1;
						if(cb) cb(s);
						s.onload = s.onreadystatechange = null;
					}
				};
				
				if(is_undef(timeout)) timeout = 5000;

				w.setTimeout(function() {
					if( !done) {
						done = 1;
						if(cb) cb(s,1);
					}
				}, timeout);
				
				_fScript.parentNode.insertBefore( s, _fScript );
			},
			/**
			 * Sets global javascript variables by using the window object.
			 */
			vars : function (vars, cb) {
				//set var in window so that all scripts can access them
				for (var i = vars.length - 1; i >= 0; i--) {
					w[vars[i]] = vars[vars[i]];
				}
				if (typeof cb === 'undefined') cb();
			}
		};

		return {
			//public
			loadConfig: loadConfig,
			action: function() {
				var args = arguments;
				setTimeout(function() {
					ctrack.apply(w.ctrack, args);
				},0);
			},
			// action: ctrack,
			load: loadHelpers,
			addTrackers: addTrackers
		};
	})();
})(window);


(function (t) {
	/**
	 * Code for trackers as defined in the JSON config file where for
	 * each tracker must have a function defined which must take the
	 * following params:
	 *
	 * ins, action, label, params
	 *
	 * action: current action
	 * label: defined in config for this context & action
	 * params: extra params passed to CTrack.track
	 *
	 * Make use of the load helpers i.e. load['js'], load['image'], load['vars']
	 */
	t.addTrackers(
		{
			/**
			 * Google Conversion Tracking
			 * uses: vars, js
			 */
			gc: function(action,label,params) {
				//console.log("T: GCONV");
				var gvar = {
					google_conversion_id: 1030005339,
					google_conversion_language: 'en',
					google_conversion_format: 3,
					google_conversion_color: 'ffffff',
					google_conversion_value: 0
				};
				gvar['google_conversion_label'] = label['label'];
				t.load['vars'](gvar);
				t.load['js']('https://www.googleadservices.com/pagead/conversion.js',
					function (){
						//console.log("T: GCONV #JS");
					}
				);
			},
			/**
			 * Google Conversion Tracking via Image
			 * uses: image
			 */
			gc_i: function(action,label,params) {
				//console.log("T: GCONV_I");
				t.load['image']("https://www.googleadservices.com/pagead/conversion/1030005339/?guid=ON&script=0&label=" + label['label'],
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
			gaq: function(action,label,params) {
				//console.log("T: GANAL");
				if (typeof params === 'undefined' && typeof params['id'] === 'undefined') label[2] += "_" + params['id'];
				if(typeof window["_gaq"] === 'undefined') {
					t.load['vars']({ "_gaq" : [] });
					t.load['js']("http://www.google-analytics.com/ga.js", function () {
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
			alert: function() {
				alert(arguments[0]);
				alert(arguments[1]);
			}
		}
	);
})(window.ctrack);