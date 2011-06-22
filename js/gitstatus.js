/**
 *	Gitstat.js
 *	
 *	A freely available library/widget/script/whatever
 *	that pulls down data from Github about a repository and
 *	displays the latest commits, along with a few other nice stats.
 *
 *	This script is needlessly documented; if you're a veteran JS developer a lot
 *	of the comments in here will seem useless to you, but to people who are still trying
 *	to learn the language some of this stuff isn't easy to figure out, so I prefer to try
 *	and let them have ample documentation to learn from. ;)
 *
 *	@Author: Ryan McGrath <ryan@venodesigns.net> | http://twitter.com/ryanmcgrath
 *	@Requires: Nothing, completely stand-alone (because, y'know, nobody NEEDS jQuery ;P) 
 */

;(function(existing_gitstatus) {
	/**
	 *	If this script hasn't already been run once, we're fine to create this object and so forth; we only
	 *	want this to happen once to avoid potential overhead (however minimal).
	 */
	if(existing_gitstatus !== 'undefined') return;

	/**
	 *	new GitStatus(opts);
	 *	
	 *	The main object that we'll instantiate for each badge. Every instance of this will have its own routines
	 *	that run for it. We accept the "opts" as an object (or hash), and just store it for later use. Opts can have
	 *	a few parameters, take note.
	 *
	 *	@param opts - An object/hash with various settings that get thrown onto the widget at render time.
	 *		:id - String (required). The id of the HTML node to inject this widget into.
	 *		:disable_tyles - Boolean (optional). Disables all attempts at CSS styling by this widget and leaves it up to the user.
	 *		:github_username - String (required). The username of the person who owns the repository we're going to pull down data about.
	 *		:github_repository - String (required). The name of the repository to pull down data about.
	 *	
	 *	@returns object (instantiated GitStatus) 
	 */
	var GitStatus = window.GitStatus = function GitStatus(opts) { 
		this.opts = opts;
		if(typeof this.opts.no_of_commits === 'undefined') this.opts.no_of_commits = 5;
	};
	
	/**
	 *	GitStatus.util
	 *	
	 *	A general purpose dumping ground for utility functions (function-scope binding, JSON-P, etc).
	 */
	GitStatus.util = {
		/**
		 *	Some flags for debugging that we might consider wanting down the road. Nothing too fancy, but worth
		 *	having (should make life a wee bit easier down the road).
		 */
		DEBUG: false,
		
		/**
		 *	GitStatus.util.bind(bindReference, fn)
		 *
		 *	Takes a reference (an object to scope to "this" at a later runtime) and binds it to a function (fn).
		 *
		 *	@param bindReference - An object to set as the "this" reference for a later function call.
		 *	@param fn - A function to bind the "this" object for.
		 *	@returns fn - A new function to pass around, wherein it's all scoped as you want it.
		 */
		bind: function(bindReference, fn) {
		    return function() {
		        return fn.apply(bindReference, arguments);
		    };
		},

		/**
		 *	GitStatus.util.loadScript(src, optional_callbackfn)
		 *
		 *	Handles pulling down script tags, accepts an optional callback function that will
		 *	fire when the script fires its ready event (Note: this is NOT a JSON-P callback, see the next function for that).
		 *
		 *	@param src - Required, the source URI for the script we're gonna toss onto the page.
		 *	@param optional_callbackfn - Optional, a callback function that will execute once this script is done.
		 *	@returns - void (nothing)
		 */
		loadScript: function(src, optional_callbackfn) {
		    var newScript = document.createElement("script");
		    newScript.type = "text/javascript";
		    newScript.setAttribute("src", src);

			/**
			 *	For newer browsers that support this, we're fine to set this - it's basically stating
			 *	that we don't have any dependencies here to worry about and we're fine to let this go
			 *	out on its own and report back when done.
			 *
			 *	If you were to have a dependency situation, you'd probably end up chaining loadScript callbacks to
			 *	achieve your desired order.
			 */
			newScript.setAttribute("async", "true");

		    /**
		     *	Automagically handle cleanup of injected script tags, so we don't litter someone's DOM
		     *	with our stuff. This branches for obvious reasons - i.e, IE. 
		     */
		    if(newScript.readyState) {
		        newScript.onreadystatechange = function() {
		            if(/loaded|complete/.test(newScript.readyState)) {
		                newScript.onreadystatechange = null;
		                if(typeof optional_callbackfn !== "undefined") optional_callbackfn();
		                !GitStatus.util.DEBUG && newScript && document.documentElement.firstChild.removeChild(newScript);
		            }
		        }
		    } else {
		        newScript.addEventListener("load", function() {
		            if(typeof optional_callbackfn !== "undefined") optional_callbackfn();
		            !GitStatus.util.DEBUG && newScript && document.documentElement.firstChild.removeChild(newScript);
		        }, false);
		    }

		    /**
			 *	Install it in an easy to retrieve place (that's also consistent - god forbid, someone might be using frames somewhere...?). 
			 */
		    document.documentElement.firstChild.appendChild(newScript);
		},

		/**
		 *	GitStatus.util.jsonp(src, callbackfn, optional_scope, optional_fn_name)
		 *
		 *	JSON-P function; fetches an external resource via a dynamically injected <script> tag. Said source needs to be wrapping its response
		 *	JSON in a Javascript callback for this to work; what this function does is properly scope arguments and temporarily set a function in the
		 *	global scope that can be accessed by any newly loaded script. 
		 *	
		 *	Once the script loads, we pass the results it gets to the real function, and then clean up the mess this script created as best we can.
		 *
		 *	Note: this function piggybacks on top of GitStatus.util.loadScript (up above); the logic contained in this function is moreso used for handling
		 *		cleanup specific to the JSON-P call style (e.g, an odd global function sitting out there).
		 *	
		 *	@param src - Required, the source URI for the script we're gonna toss onto the page.
		 *	@param callbackfn - Required, a callback function that will execute once this script is done (and be passed the proper results for).
		 *	@param optional_scope - Optional, a scope to tie the callback structure to.
		 *	@param optional_fn_name - Optional, a function name (as a String) to have this JSON-P callback pass things to (otherwise we generate a randomized name).
		 *	@returns void (nothing)
		 */
		jsonp: function(src, callbackfn, optional_scope, optional_fn_name) {
		    var callback = typeof optional_scope !== "undefined" ? GitStatus.util.bind(optional_scope, callbackfn) : callbackfn,
		        callbackGlobalRef = typeof optional_fn_name !== "undefined" ? optional_fn_name : "GitStatusJSONPCallback_" + parseInt(Math.random() * 100000),
		        apiURL = src + (src.indexOf("?") > -1 ? "&callback=" : "?callback=") + callbackGlobalRef,
		        globalCallback = null;

		    /**
			 *	After the callback has actually been fired, we should attempt cleanup. In the case of this widget it's probably
			 *	not the worst thing in the world, but eh, no sense in being kind.
		     */
		    globalCallback = GitStatus.util.bind(this, function(results) {
		        callback(results);
		        try {
		            /**
					 *	Eh why the hizell not. 
					 */
		            delete window[callbackGlobalRef];
		        } catch(e) {
		            /**
					 *	Let it get (hopefully) garbage collected in the future. 
					 */
		            window[callbackGlobalRef] = null;
		        }
		    });
		
		    /**
  			 *	We need a global reference to a bound function to execute once the data endpoint downloads
		     *  and fires. (Generally namespace'd [to a degree] with a hint of random-ness).
		     */
		    window[callbackGlobalRef] = globalCallback;

		    /**
			 *	Now that we've got that all in place, we can defer over to loadScript. Note that in a way
			 *	we're ignoring callbacks here - our true callback (that gets the JSON) is handled in the actual
			 *	response.
			 *
		     *  @note: Bind this to the jsonp scope, so the callback chain persists and we can clean up the global
			 *		scope when we're done. Script tag cleanup is handled naturally by GitStatus.util.loadScript().
		     */
		    GitStatus.util.loadScript(apiURL);
		},
		
		/**
		 *	GitStatus.util.createGravatarURL(gravatar_hash)
		 *
		 *	Handles constructing the ideal URL for a users gravatar, based on the hash/gravatar_id that's passed. In our
		 *	case, we get it from GitHub.
		 *
		 *	@param gravatar_hash: Required, the hash/gravatar_id for the query to Gravatar's servers.
		 */
		createGravatarURL: function(gravatar_hash) {
			return 'http://www.gravatar.com/avatar/' + gravatar_hash + '?s=50&d=mm';
		},
		
		/**
		 *	GitStatus.util.render(template, context)
		 *
		 *	A crucially fun method... that's actually just a generic key/value template replacement function.
		 *	Should be fairly self explanatory, see the _build() function for example usage.
		 *
		 *	Yes, I'm aware of how simplistic this function is and how it could be much better.
		 *
		 *	@param template - Required, String, the template you want to parse.
		 *	@param context - Required, Object, a key/value store that you'll have parsed into your template. E.g, if template
		 *		has {{key}} and your object is {'key': 'value'}, {{key}} will become 'value'. Simple and sweet. ;P
		 *	@returns String, parsed/replaced template.
		 */
		render: function(template, context) {
			for(x in context) template = template.replace(new RegExp('{{' + x + '}}', 'g'), context[x]);
			return template;
		}
	};

	/**
	 *	Ah, now we finally get to the real widget-specific logic. Every instantiated GitStatus object gets a set of the methods
	 *	and variables below.
	 */
	GitStatus.prototype = {
		/**
		 *	This will get set as opts are passed to the "new GitStatus()" function, but I generally keep a placeholder like this
		 *	around for my own memory of what exists where.
		 */
		opts: null,
		node: null,
		api_base: 'https://github.com',
		api_base_url: '',
		
		/**
		 *	Some people choose to do their templating in various ways, be it Mustache/etc. Some also choose to do the line-ending trick
		 *	for long run-on templates in JS; I prefer to do it in an Array, control the indentation structure, then join it all once. The
		 *	performance hit is negligible and it's overall cleaner and easier to maintain. ;P
		 *
		 *	YMMV, of course. This is the base structure of this widget - the wrapper, if you will.
		 */
		base_structure: [
			'<div class="gitstatus_header">',
				'Recent Commits on <a href="{{repo_url}}" title="{{repo_name}}" target="_blank">{{repo_name}}</a>',
			'</div>',
			'<div class="gitstatus_commit_history">',
				'{{history}}',
			'</div>',
			'<div class="gitstatus_footer">',
				'<a href="#" title="Get Your Own" target="_blank">Get Your Own!</a>',
			'</div>'
		].join(''),
		
		/**
		 *	The general structure for a commit "row". There's a lot of data to be parsed in to this template, and it happens for each commit - 
		 *	shouldn't be too intensive, but eh, storing it like this let's people customize as they like. Not too shabby...
		 */
		commit_structure: [
			'<div class="gitstatus_commit_row {{even_or_odd}}">',
				'<img src="{{gravatar}}" alt="" class="gitstatus_gravatar" width="50" height="50">',
				'<div class="gitstatus_commit_row_log">',
					'<div class="gitstatus_commit_row_sha"><a href="{{sha_link}}" title="View this commit" target="_blank">{{sha}}</a></div>',
					'<div class="gitstatus_commit_row_data">',
						'<p>{{commit_msg}}</p>',
					'</div>',
					'<div class="gitstatus_commit_row_meta">',
						'By <a href="http://github.com/{{login}}" title="Committed by {{login}}" target="_blank">{{login}}</a> on {{date}}',
					'</div>',
				'</div>',
			'</div>'
		].join(''),
		
		/**
		 *	By default this gets thrown into the document as a created stylesheet; it can be disabled by passing a "disable_all_styles" option
		 *	in the initial options.
		 */
		default_style: [
			'.gitstatus_container { -webkit-border-radius: 2px; -moz-border-radius: 2px; border-radius: 2px; }',
			'.gitstatus_container a, .gitstatus_container a:visited { color: #307ace; text-decoration: none; border-bottom: 1px solid dotted #307ace; }',
			'.gitstatus_header { text-align: right; padding: 5px; color: #f9f9f9; background-color: #010101; background-image: -webkit-gradient(linear, left top, left bottom, from(#333), to(#010101)); -moz-border-radius: 2px 2px 0 0; -webkit-border-radius: 2px 2px 0 0; border-radius: 2px 2px 0 0; }',
			'.gitstatus_commit_history { font-size: 11px; border-left: 1px solid #c9c9c9; border-right: 1px solid #c9c9c9; }',
			'.gitstatus_commit_row { padding: 5px 5px 5px 63px; position: relative; background-color: #f5f5f5; border-bottom: 1px solid #c9c9c9;  -webkit-box-shadow: inset 2px 2px 2px #e9e9e9; -moz-box-shadow: inset 2px 2px 2px #e9e9e9; box-shadow: inset 2px 2px 2px #e9e9e9;}',
			'.gitstatus_row_even { background-color: #f9f9f9 !important; }',
			'.gitstatus_commit_row_meta { color: #b2b2b2; }',
			'.gitstatus_commit_row_meta a, .gitstatus_commit_row_meta a:visited { color: #a2a2a2 !important; border-color: #a2a2a2 !important; }',
			'.gitstatus_gravatar { -webkit-border-radius: 2px; -moz-border-radius: 2px; border-radius: 2px; position: absolute; top: 7px; left: 5px; }',
			'.gitstatus_footer { font-size: 10px !important; padding: 3px 5px 5px; text-align: right; color: #f9f9f9; background-color: #010101; background-image: -webkit-gradient(linear, left top, left bottom, from(#333), to(#010101)); -moz-border-radius: 0 0 2px 2px; -webkit-border-radius: 0 0 2px 2px; border-radius: 0 0 2px 2px; }'
		].join(''),
		
		/**
		 *	GitStatus.show();
		 *
		 *	Ohhh, the main loop/logic area, how fun you are... so this method has a few intricacies to deal with GitHub's (rather generous, mind you)
		 *	API limitations. To get a range of commits for a repository we actually need to make _two calls_; this isn't ideal, but there's really
		 *	not too much we can do about it.
		 *
		 *	Luckily, all our JSON-P methods operate in a callback-based scenario! See why we did that? ;D
		 */
		show: function() {
			this.api_base_url = this.api_base + '/' + this.opts.github_username + '/' + this.opts.github_repository + '/';
			GitStatus.util.jsonp(this.api_base_url + 'network_meta', this._getRepoNetworkData, this);
			return this;
		},

		/**
		 *	GitStatus._getRepoNetworkData(network_meta_data)
		 *
		 *	This is the second phase of the widget-setup; this function is our callback for the network_meta_data call
		 *	to Github, and purely exists as a stub to grab the nethash property from the network_meta_data results object,
		 *	then fire the next stage (pulling down the actual commit data we want to display).
		 *
		 *	@param network_meta_data - (JSON) object; this is pretty much a private method, just fyi.
		 *	@returns void (nothing)
		 */
		_getRepoNetworkData: function(network_meta_data) {
			var nethash = network_meta_data.nethash,
				focus = network_meta_data.focus,
				api = this.api_base_url + 'network_data_chunk?nethash=' + nethash + '&start=' + (focus - this.opts.no_of_commits) + '&end=' + focus;
				
			GitStatus.util.jsonp(api, this._build, this);
		},
		
		/**
		 *	GitStatus._build(network_data_chunk)
		 *
		 *	This is the "final" phase of the widget-setup; this function is yet another callback routine, one that expects
		 *	to be passed the commit data we want. This acts as the final callback, which should be chained into from _getRepoNetworkData.
		 *
		 *	@param network_data_chunk - (JSON) object; this is pretty much a private method, just fyi.
		 *	@returns void (nothing)
		 */
		_build: function(network_data_chunk) {
			/*	We probably don't have a reference to this, but we haven't really needed it until now. Grab it. */
			if(this.node === null) this.node = document.getElementById(this.opts.id);
			
			/**
			 *	We'll build it all inside a document fragment, as this is generally faster to do construction in (avoids reflowing the page
			 *	while we build up a node chain). Many frameworks do this internally.
			 */
			var frag = document.createDocumentFragment(),
				container = document.createElement('div'),
				commit_history = '',
				commits = network_data_chunk.commits,
				i = commits.length;
			
			container.className = 'gitstatus_container';
			frag.appendChild(container);
			
			/**
			 *	We've got a stage set up now (our fragment), so let's build this thing up and get things rolling...
			 *	
			 *	For each commit, we need to go through and get a rendered row. We'll handle the wrapper rendering in a second.
			 */
			while(i--) {
				commit_history += GitStatus.util.render(this.commit_structure, {
					'even_or_odd': (i % 2 === 0 ? 'gitstatus_row_even' : 'gitstatus_row_odd'),
					'gravatar': GitStatus.util.createGravatarURL(commits[i].gravatar),
					'sha_link': 'https://github.com/' + this.opts.github_username + '/' + this.opts.github_repository + '/commit/' + commits[i].id,
					'sha': 'Commit #' + commits[i].id.substr(0, 7),
					'commit_msg': commits[i].message,
					'login': commits[i].login,
					'date': commits[i].date
				});
			}
			
			/**
			 *	Now we'll go ahead and just innerHTML the entire thing into our fragment
			 */
			container.innerHTML = GitStatus.util.render(this.base_structure, {
				'repo_name': this.opts.github_repository,
				'repo_url': this.api_base_url,
				'history': commit_history
			});
			
			/**
			 *	If we don't need default CSS (e.g, user will override themselves), 
			 */
			if(typeof this.opts.disable_default_styles === 'undefined') { 
				var style = document.createElement('style');
				style.type = 'text/css';

				if(style.styleSheet) {
					style.styleSheet.cssText = this.default_style;
				} else {
					style.appendChild(document.createTextNode(this.default_style));
				}

				document.documentElement.firstChild.appendChild(style);
			}
			
			/**
			 *	Huzzah! We made it here, she's all constructed and ready to go... now let's actually show it. ;)
			 */
			this.node.appendChild(frag);
		}
	};
})(typeof window.GitStatus);