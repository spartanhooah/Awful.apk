'use strict';

/**
 * Initializes the container holding all the posts.
 */
function containerInit() {
	var container = document.getElementById('container');

	// Most click events
	container.addEventListener('click', function containerClick(event) {
		var target = event.target;

		if (findInPath(event, 'toggleread')) {
			showReadPosts();
			return;
		}
		if (findInPath(event, 'posterinfo')) {
			toggleInfo(findInPath(event, 'posterinfo', true));
			return;
		}
		if (findInPath(event, 'postmenu')) {
			showPostMenu(findInPath(event, 'postmenu', true));
			return;
		}
		if (findInPath(event, 'timg')) {
			enlargeTimg(findInPath(event, 'timg', true));
			return;
		}
		if (findInPath(event, 'quote_link')) {
			handleQuoteLink(target, event);
			return;
		}
		if (target.tagName === 'A' && target.href.indexOf('showthread.php?action=showpost') !== -1) {
			loadIgnoredPost(target, event);
			return;
		}
		if (target.tagName === 'IMG' && target.hasAttribute('title') && target.src.endsWith('.gif')) {
			freezeGif(target);
			return;
		}
		if (target.tagName === 'CANVAS' && target.hasAttribute('title') && target.getAttribute('src').endsWith('.gif')) {
			target.outerHTML = '<img src="' + target.getAttribute('src') + '" title="' + target.getAttribute('title') + '" />';
			return;
		}
		if (findInPath(event, 'bbc-spoiler') && listener.getPreference('showSpoilers') !== 'true') {
			findInPath(event, 'bbc-spoiler', true).classList.toggle('spoiled');
		}
	});

	// Some touch events, freezing gifs and blocking side-swiping on code-blocks
	container.addEventListener('touchstart', function touchStartHandler(event) {
		var target = event.target;
		// title popup on long-press
		if ((target.tagName === 'IMG' || target.tagName === 'CANVAS')) {
			Longtap(function longtap() {
				if (target.hasAttribute('title')) {
					listener.popupText(target.getAttribute('title'));
				} else {
					showImageZoom(target.src)
				}
			})(event);
			return;
		}
		if (target.tagName === 'VIDEO') {
			Longtap(function longtap() {
				listener.openUrlMenu(target.firstElementChild.getAttribute('src'));
			})(event);
			return;
		}
		var bbcBlock = findInPath(event, 'bbc-block', true);
		if (bbcBlock && !!bbcBlock.className.match(/pre|code|php/ig)) {
			listener.haltSwipe();
			document.addEventListener('touchend', handleTouchLeave);
			document.addEventListener('touchleave', handleTouchLeave);
			document.addEventListener('touchcancel', handleTouchLeave);
		}
	}, { passive: true });
	// Auto-starting of videos
	if (listener.getPreference('inlineWebm') === 'true' && listener.getPreference('autostartWebm') === 'true') {
		var debouncedVideosScrollListener = debounce(pauseVideosOutOfView, 250);

		window.addEventListener('scroll', function containerScroll() {
			debouncedVideosScrollListener();
		});
	}

	window.addEventListener('awful-scroll-post', function scrollToPost() {
		window.topScrollID = window.requestAnimationFrame(scrollPost.bind(null, null));
	});

	// trigger a page content load, in case some was sent before the container was ready to handle it
	loadPageHtml();
}

/**
 * This message tries to find a css class in the path of an event
 * @param {Event} event Initiating user event
 * @param {String} cssClass CSS class that is expected
 * @param {Boolean} returnElement If true returns the found element
 * @returns {Element|undefined} The requested Element or undefined if the Element is not found
 */
function findInPath(event, cssClass, returnElement) {
	// Standards-compliant approach is event.composedPath(), but it was added in Chromium 53 and
	// Android 5 (API level 21) could still be using Chromium 37. So we check for the deprecated
	// event.path and use the standard approach if the older approach fails.
	var search = Array.prototype.filter.call(event.path || event.composedPath(), function filter(node) {
		return node.classList && node.classList.contains(cssClass);
	});
	return returnElement ? search[0] : search.length > 0;
}

/**
 * Loads the current thread html into the body container
 */
function loadPageHtml() {
	if (window.topScrollTimeout) {
		window.clearTimeout(window.topScrollTimeout);
		window.cancelAnimationFrame(window.topScrollID);
	}

	window.topScrollItem = null;
	window.topScrollPos = 0;
	window.topScrollCount = 0;
	var html = listener.getBodyHtml();
	document.getElementById('container').innerHTML = html;
	if (!html) {
		return;
	}
	exitImageZoom();
	pageInit();
	window.topScrollTimeout = window.setTimeout(function hello() {
		window.dispatchEvent(new Event('awful-scroll-post'));
	}, 1000);
	document.addEventListener('DOMContentLoaded', function updateCssForPage() {
		changeCSS(listener.getCSS());
	});
}

/**
 * Initializes the newly added posts that have just been added to the container
 */
function pageInit() {
	document.head.querySelectorAll('.JSONP').forEach(function removeScripts(script) {
		script.remove();
	});
	var spoilers = document.body.querySelectorAll('.bbc-spoiler');
	spoilers.forEach(function each(spoiler) {
		spoiler.removeAttribute('onmouseover');
		spoiler.removeAttribute('onmouseout');
		if (listener.getPreference('showSpoilers') === 'true') {
			spoiler.classList.remove('bbc-spoiler');
		}
	});
	// hide-old posts
	if (document.body.querySelector('.toggleread') !== null) {
		document.body.querySelectorAll('.read').forEach(function each(post) {
			post.style.display = 'none';
		});
	}

	processPosts();
	if (window.twttr && !window.twttr.init) {
		window.twttr.insertTag();
	}

}

/**
 * Processes posts
 * @param {Element} scopeElement The element containing posts to process
 */
function processPosts(scopeElement) {
	if (!scopeElement) {
		scopeElement = document;
	}

	if (listener.getPreference('hideSignatures') === 'true') {
		scopeElement.querySelectorAll('.postcontent .signature').forEach(function each(signature) {
			signature.remove();
		});
	}

	processThreadEmbeds(scopeElement);

	if (listener.getPreference('inlineWebm') === 'true' && listener.getPreference('autostartWebm') === 'true') {
		pauseVideosOutOfView(scopeElement);
	}

	if (listener.getPreference('highlightUsername') === 'true') {
		highlightOwnUsername(scopeElement);
	}

	if (listener.getPreference('highlightUserQuote') === 'true') {
		highlightOwnQuotes(scopeElement);
	}

	// handle all GIFs that are not avatars
	if (listener.getPreference('disableGifs') === 'true') {
		scopeElement.querySelectorAll('img[title][src$=".gif"]:not(.avatar)').forEach(prepareFreezeGif);
	}

	// this handles all avatar processing, meaning if the avatar is a GIF we need to handle freezing as well
	scopeElement.querySelectorAll("img[title].avatar").forEach(function each(img) {
		img.addEventListener('load', processSecondaryAvatar);
	});
	function processSecondaryAvatar() {
		// when people want to use gangtags as avatars, etc., they often use a 1x1 image as their primary avatar.
		// if this is the case, we change over to a "secondary" avatar, which is probably what's intended.
		if (this.naturalWidth === 1 && this.naturalHeight === 1 && this.dataset.avatarSecondSrc && this.dataset.avatarSecondSrc.length) {
			this.src = this.dataset.avatarSecondSrc;
		}

		if (listener.getPreference('disableGifs') === 'true' && this.src.slice(-4) === ".gif") {
			prepareFreezeGif(this);
		}
	}
}

/**
 * Eventhandler that pauses all videos that have been scrolled out of the viewport and starts all videos currently in the viewport
 * @param {Element} scopeElement The element containing videos to pause
 */
function pauseVideosOutOfView(scopeElement) {
	scopeElement = scopeElement || document;
	scopeElement.querySelectorAll('video').forEach(function eachVideo(video) {
		if (isElementInViewport(video) && video.parentElement.parentElement.tagName !== 'BLOCKQUOTE' && video.firstElementChild.src.indexOf('webm') === -1) {
			video.play();
		} else {
			video.pause();
		}
	});
}

/**
 * Sets up the scrollUpdate function parameters
 * @param {number} count How many times to try to scroll to the element
 * @param {Element} element The element to scroll to
 */
function setTopScroll(count, element) {
	window.topScrollCount = count;
	window.topScrollItem = element;
	window.topScrollPos = window.topScrollItem.getBoundingClientRect().top + window.scrollY;
	window.scrollTo(0, window.topScrollPos);
	window.topScrollID = requestAnimationFrame(scrollUpdate);
}

/**
 * Scrolls the webview to a certain post or the first unread post
 * @param {String} [postNumber] number of the post to just to
 */
function scrollPost(postNumber) {
	var postjump = postNumber || listener.getPostJump();
	if (postjump !== '') {
		try {
			setTopScroll(200, document.getElementById(postjump));
		} catch (error) {
			scrollLastRead();
		}
		return;
	}
	scrollLastRead();
}

/**
 * Scrolls the webview to the first unread post
 */
function scrollLastRead() {
	try {
		setTopScroll(100, document.body.querySelector('.unread'));
	} catch (error) {
		window.topScrollCount = 0;
		window.topScrollItem = null;
	}
}

/**
 * Updates the scroll position
 */
function scrollUpdate() {
	try {
		if (window.topScrollCount > 0 && window.topScrollItem) {
			var newPosition = window.topScrollItem.getBoundingClientRect().top + window.scrollY;
			if (newPosition - window.topScrollPos > 0) {
				window.scrollBy(0, newPosition - window.topScrollPos);
			}
			window.topScrollPos = newPosition;
			window.topScrollCount--;
			window.topScrollID = requestAnimationFrame(scrollUpdate);
		}
	} catch (error) {
		window.topScrollCount = 0;
		window.topScrollItem = null;
	}
}

/**
 * Makes already read posts visible
 */
function showReadPosts() {
	document.body.querySelectorAll('.read').forEach(function showAllReadPosts(post) {
		post.style.display = '';
	});
	document.body.querySelector('.toggleread').remove();
	window.requestAnimationFrame(scrollLastRead);
}

/**
 * Creates an overlay to allow zooming an image
 * Based on https://codepen.io/josephmaynard/pen/OjWvNP
 * @param {string} url url to zoom into
 */
function showImageZoom(url) {
	listener.setZoomEnabled(true);
	var zoom = document.createElement('div');
	zoom.setAttribute('id', 'zoom');
	zoom.classList.add('zoom-enabled');
	document.body.appendChild(zoom)
	var zoomClose = document.createElement('div');
	zoomClose.setAttribute('id', 'zoom-close');
	document.body.appendChild(zoomClose)
	zoomClose.addEventListener('click', exitImageZoom);

    var minScale = 1;
    let maxScale = 5;
    let imageWidth;
    let imageHeight;
    let containerWidth;
    let containerHeight;
    let imageX = 0;
    let imageY = 0;
    let imageScale = 1;

    let displayDefaultWidth;
    let displayDefaultHeight;

    let rangeX = 0;
    let rangeMaxX = 0;
    let rangeMinX = 0;

    let rangeY = 0;
    let rangeMaxY = 0;
    let rangeMinY = 0;

    let imageRangeY = 0;

    let imageCurrentX = 0;
    let imageCurrentY = 0;
    let imageCurrentScale = 1;


    function resizeContainer() {
      containerWidth = zoom.offsetWidth;
      containerHeight = zoom.offsetHeight;
    }

    resizeContainer();

    function clamp(value, min, max) {
      return Math.min(Math.max(min, value), max);
    }

    function clampScale(newScale) {
      return clamp(newScale, minScale, maxScale);
    }

    const image = new Image();
    image.src = url;
    image.onload = function () {
      imageWidth = image.width;
      imageHeight = image.height;
      zoom.appendChild(image);
      image.addEventListener('mousedown', e => e.preventDefault(), false);
      displayDefaultWidth = image.offsetWidth;
      displayDefaultHeight = image.offsetHeight;
      rangeX = Math.max(0, displayDefaultWidth - containerWidth);
      rangeY = Math.max(0, displayDefaultHeight - containerHeight);
    }


    function updateImage(x, y, scale) {
      const transform = 'translateX(' + x + 'px) translateY(' + y + 'px) translateZ(0px) scale(' + scale + ',' + scale + ')';
      image.style.transform = transform;
    }

    function updateRange() {
      rangeX = Math.max(0, Math.round(displayDefaultWidth * imageCurrentScale) - containerWidth);
      rangeY = Math.max(0, Math.round(displayDefaultHeight * imageCurrentScale) - containerHeight);

      rangeMaxX = Math.round(rangeX / 2);
      rangeMinX = 0 - rangeMaxX;

      rangeMaxY = Math.round(rangeY / 2);
      rangeMinY = 0 - rangeMaxY;
    }

    const hammertime = new Hammer(zoom,{ inputClass: Hammer.TouchMouseInput });

    hammertime.get('pinch').set({ enable: true });
    hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL });

    hammertime.on('pan', function(ev) {
      imageCurrentX = clamp(imageX + ev.deltaX, rangeMinX, rangeMaxX);
      imageCurrentY = clamp(imageY + ev.deltaY, rangeMinY, rangeMaxY);
      updateImage(imageCurrentX, imageCurrentY, imageScale);
    });

    hammertime.on('pinch pinchmove',function (ev) {
      imageCurrentScale = clampScale(ev.scale * imageScale);
      updateRange();
      imageCurrentX = clamp(imageX + ev.deltaX, rangeMinX, rangeMaxX);
      imageCurrentY = clamp(imageY + ev.deltaY, rangeMinY, rangeMaxY);
      updateImage(imageCurrentX, imageCurrentY, imageCurrentScale);
    });

    hammertime.on('panend pancancel pinchend pinchcancel', function(){
      imageScale = imageCurrentScale;
      imageX = imageCurrentX;
      imageY = imageCurrentY;
    });
}

/**
 * Exists the zoom overlay
 */
function exitImageZoom() {
	if(!document.getElementById('zoom')){ return }
    document.getElementById('zoom').remove();
    document.getElementById('zoom-close').remove();
	listener.setZoomEnabled(false);
}

/**
 * Load an image url and replace links with the image. Handles paused gifs and basic text links.
 * @param {String} url The image URL
 */
function showInlineImage(url) {
	var LOADING = 'loading';
	var FROZEN_GIF = 'playGif';

	if (url.startsWith('https://forums.somethingawful.com/attachment.php?')) {
		url = url.split('/')[3];
	}

	/**
	 * Adds an empty Image Element to the Link if the link is not around a gif
	 * @param {Element} link Link Element
	 */
	function addEmptyImg(link) {
		// basically treating anything not marked as a frozen gif as a text link
		if (!link.classList.contains(FROZEN_GIF)) {
			var image = document.createElement('img');
			image.src = '';
			link.appendChild(image);
		} else {
			link.classList.add(LOADING);
		}
	}

	/**
	 * Inlines the loaded image
	 * @param {Element} link The link the image is wrapping
	 */
	function inlineImage(link) {
		var image = link.querySelector('img');
		image.src = url;
		image.style.height = 'auto';
		image.style.width = 'auto';
		link.classList.remove(LOADING);
		link.classList.remove(FROZEN_GIF);
	}
	// skip anything that's already loading/loaded
	var imageLinks = document.body.querySelectorAll('a[href="' + url + '"]:not(.loading)');
	imageLinks.forEach(addEmptyImg);

	var pseudoImage = document.createElement('img');
	pseudoImage.src = url;
	pseudoImage.addEventListener('load', function loadHandler() {
		// when the image is loaded, inline it everywhere and update the links
		imageLinks.forEach(inlineImage);
		pseudoImage.remove();
	});
}

/**
 * Changes the font-face of the webview
 * @param {String} font The name of the font
 */
function changeFontFace(font) {
	var fontFace = document.getElementById('font-face');
	if (fontFace !== null) {
		fontFace.remove();
	}
	if (font !== 'default') {
		var styleElement = document.createElement('style');
		styleElement.id = 'font-face';
		styleElement.setAttribute('type', 'text/css');
		styleElement.textContent = '@font-face { font-family: userselected; src: url(\'file:///android_asset/' + font + '\'); }';
		document.head.appendChild(styleElement);
	}
}

/**
 * Paints a gif on a canvas and replaces the original image with the canvas.
 * @param {Element} image Gif image that will be turned into a still canvas
 */
function freezeGif(image) {
	var canvas = document.createElement('canvas');
	var imageWidth = image.naturalWidth;
	var imageHeight = image.naturalHeight;
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	canvas.getContext('2d').drawImage(image, 0, 0, imageWidth, imageHeight);
	// if possible, retain all css aspects
	for (var i = 0; i < image.attributes.length; i++) {
		canvas.setAttribute(image.attributes[i].name, image.attributes[i].value);
	}
	image.parentNode.replaceChild(canvas, image);
}

/**
 * Monitors a gif to freeze it when loading's complete.
 * @param {Element} image Gif image to monitor
 */
function prepareFreezeGif(image) {
	if (!image.complete) {
		image.addEventListener('load', function freezeLoadHandler() {
			freezeGif(image);
		});
	} else {
		freezeGif(image);
	}
}

/**
 * Updates the background color of all posters that were previously, or are now, marked by the user
 * @param {String} users A string of users separated by commas
 */
function updateMarkedUsers(users) {
	document.body.querySelectorAll('article.marked').forEach(function each(markedPoster) {
		markedPoster.classList.remove('marked');
	});
	var userArray = users.split(',');
	userArray.forEach(function each(username) {
		document.body.querySelectorAll('.postmenu[username="' + username + '"]').forEach(function each(poster) {
			poster.closest('article').classList.add('marked');
		});
	});
}

/**
 * wait for redraw
 * @param {String} id the id of the post
 */
function waitForRedraw(id) {
	if (document.getElementById(id).style.display === 'none') {
		window.requestAnimationFrame(waitForRedraw.bind(null, id));
		return;
	}
	window.setTimeout(scrollPost.bind(null, id), 500);
}

/**
 * Handles a quote link click event depending on the URL of the link. Moves the webview if the post is on the same page
 * @param {Element} link The HTMLElement of the link
 * @param {Event} event The click-event triggered by the user
 */
function handleQuoteLink(link, event) {
	var id = link.hash.substring(1);
	try {
		var postOfID = document.getElementById(id);
		if (!postOfID) {
			return;
		}
		event.preventDefault();
		if (postOfID.style.display === 'none') {
			var readPosts = document.body.querySelectorAll('.read');
			document.body.querySelector('.toggleread').remove();
			readPosts.forEach(function eachPost(readPost) {
				window.requestAnimationFrame(function wait() {
					readPost.style.display = '';
				});
			});
			readPosts[0].offsetHeight;
			window.requestAnimationFrame(waitForRedraw.bind(null, id));
			return;
		}

		scrollPost(id);

	} catch (error) {
		window.console.log(error);
	}
}

/**
 * Expands or retracts the postinfo
 * @param {Element} info The HTMLElement of the postinfo
 */
function toggleInfo(info) {
	var posterTitle = info.querySelector('.postinfo-title');
	var posterRegDate = info.querySelector('.postinfo-regdate');
	if (!posterTitle) { return; }

	if (posterTitle.classList.contains('extended')) {
		if (info.querySelector('.avatar') !== null) {
			if (listener.getPreference('disableGifs') === 'true' && info.querySelector('.avatar').src.endsWith('.gif')) {
				freezeGif(info.querySelector('.avatar'));
				info.querySelector('canvas').classList.add('avatar');
			}
			window.requestAnimationFrame(function shrinkAvatar() {
				info.querySelector('.avatar').classList.remove('extended');
			});
		}
		posterTitle.classList.remove('extended');
		posterTitle.setAttribute('aria-hidden', 'true');
		if (posterRegDate) {
			posterRegDate.classList.remove('extended');
			posterRegDate.setAttribute('aria-hidden', 'true');
		}
	} else {
		if (info.querySelector('.avatar') !== null) {
			if (info.querySelector('canvas') !== null) {
				var avatar = document.createElement('img');
				avatar.src = info.querySelector('canvas').getAttribute('src');
				avatar.setAttribute('style', info.querySelector('canvas').getAttribute('style'));
				avatar.classList.add('avatar');
				info.querySelector('canvas').replaceWith(avatar);
			}
			window.requestAnimationFrame(function enlargeAvatar() {
				info.querySelector('.avatar').classList.add('extended');
			});
		}
		posterTitle.classList.add('extended');
		posterTitle.setAttribute('aria-hidden', 'false');
		if (posterRegDate) {
			posterRegDate.classList.add('extended');
			posterRegDate.setAttribute('aria-hidden', 'false');
		}
	}
}

/**
 * Triggers the display of the postmenu
 * @param {Element} postMenu The HTMLElement of the postmenu
 */
function showPostMenu(postMenu) {
	// temp hack to create the right menu for rap sheet entries without making its own CSS class etc
	if (postMenu.hasAttribute('badPostUrl')) {
		showPunishmentMenu(postMenu);
		return;
	}
	var article = postMenu.closest('article');
	var avatar = article.querySelector('.avatar');

	listener.onMoreClick(
		article.getAttribute('id').replace(/post/, ''),
		postMenu.getAttribute('username'),
		postMenu.getAttribute('userid'),
		postMenu.getAttribute('lastreadurl'),
		postMenu.hasAttribute('editable'),
		postMenu.hasAttribute('has-role'),
		postMenu.hasAttribute('isPlat'),
		avatar ? avatar.getAttribute('src') : null
	);
}

/**
 * Displays the context for a leper's colony punishment
 * @param {Element} menu The HTMLElement of the clicked menu
 */
function showPunishmentMenu(menu) {
	listener.onMoreClick(
		menu.getAttribute('username'),
		menu.getAttribute('userId'),
		menu.getAttribute('badPostUrl'),
		menu.getAttribute('adminUsername'),
		menu.getAttribute('adminId')
	);
}

/**
 * Changes the styling of the webview
 * @param {String} file Name of the CSS to be used
 */
function changeCSS(file) {
	document.getElementById('theme-css').setAttribute('href', file);
}

/**
 * Loads an ignored post
 * @param {Element} post The HTMLElement of the post
 * @param {Event} event User-triggered click event
 */
function loadIgnoredPost(post, event) {
	event.preventDefault();
	var id = post.hash.substring(1);
	listener.loadIgnoredPost(id);
	post.outerHTML = '<span id="ignorePost-' + id + '">Loading Post, please wait...</span>';
}

/**
 * Replaces the previously ignored post with the loaded version
 * @param {String} id The postId of the ignored post
 */
function insertIgnoredPost(id) {
	var ignoredPost = document.getElementById('ignorePost-' + id);
	ignoredPost.innerHTML = listener.getIgnorePostHtml(id);
	processPosts(ignoredPost);
}

/**
 * Removes the timg class from a timg to turn it into a normal image
 * @param {Element} tImg The HTMLElement of the timg
 */
function enlargeTimg(tImg) {
	tImg.classList.remove('timg');
	if (tImg.parentElement.tagName !== 'A') {
		var link = document.createElement('a');
		link.href = tImg.src;
		tImg.parentNode.insertBefore(link, tImg);
		tImg.parentNode.removeChild(tImg);
		link.appendChild(tImg);
	}
}

/**
 * Checks whether the supplied Element is currently fully visible in the viewport
 * @param {Element} element The Element that checked for visibility
 * @returns {Boolean} True if the element is in the viewport
 */
function isElementInViewport(element) {

	var rect = element.getBoundingClientRect();

	return (
		rect.top >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
	);
}

/**
 * Highlight the user's username in posts
 * @param {Element} scopeElement The element containing posts to process
 */
function highlightOwnUsername(scopeElement) {

	/**
	 * Returns all textnodes inside the element
	 * @param {Element} element Where the text nodes are to be found
	 * @returns {Array} Array of text node Elements
	 */
	function getTextNodesIn(element) {
		var textNodeArray = [];
		var treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
		while (treeWalker.nextNode()) {
			textNodeArray.push(treeWalker.currentNode);
		}
		return textNodeArray;
	}

	/**
	 * Escapes a string for inserting into a regex.
	 * Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
	 */
	function escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
	}

	var selector = 'article:not(self) .postcontent';
	var username = listener.getPreference('username');

	var regExp = new RegExp('\\b' + escapeRegExp(username) + '\\b', 'g');
	var styled = '<span class="usernameHighlight">' + username + '</span>';
	scopeElement.querySelectorAll(selector).forEach(function eachPost(post) {
		getTextNodesIn(post).forEach(function eachTextNode(node) {
			if (node.wholeText.match(regExp)) {
				var newNode = node.ownerDocument.createElement('span');
				newNode.innerHTML = node.wholeText.replace(regExp, styled);
				node.parentNode.replaceChild(newNode, node);
			}
		});
	});
}

/**
 * Highlight the quotes of the user themselves.
 * @param {Element} scopeElement The element containing posts to process
 */
function highlightOwnQuotes(scopeElement) {
	var usernameQuoteMatch = listener.getPreference('username') + ' posted:';
	var quotes = scopeElement.querySelectorAll('.bbc-block h4');
	quotes = Array.prototype.filter.call(quotes, function filterQuotes(quote) {
		return quote.innerText === usernameQuoteMatch;
	});
	quotes.forEach(function eachQuote(quote) {
		quote.parentElement.classList.add('self');
		// Replace the styling from username highlighting
		quote.querySelectorAll('.usernameHighlight').forEach(function eachHighlight(name) {
			name.classList.remove('usernameHighlight');
		});
	});
}

/**
 * Debounces a function and returns it. The returned function will call the supplied callback after a predetermined amount of time
 * @param {Function} callback The callback that should be called after the wait time
 * @param {Integer} wait Time to wait in ms
 * @param {Boolean} immediate Run callback immediately if true
 * @returns {Function} Debounced function
 */
function debounce(callback, wait, immediate) {
	var timeout;
	return function debounced() {
		var that = this;
		var args = arguments;

		/**
		 * Function that is called when the timer runs out
		 */
		function later() {
			timeout = null;
			if (!immediate) {
				callback.apply(that, args);
			}
		}
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) {
			callback.apply(that, args);
		}
	};
}

/**
 * Handles the leaving of the touch event
 */
function handleTouchLeave() {
	listener.resumeSwipe();
	document.removeEventListener('touchend', handleTouchLeave);
	document.removeEventListener('touchleave', handleTouchLeave);
	document.removeEventListener('touchcancel', handleTouchLeave);
}

/**
 * Hides all instances of the given avatar on the page
 */
function hideAvatar(avatarUrl) {
	document.querySelectorAll('[src="' + avatarUrl + '"]').forEach(function (avatarTag) {
		avatarTag.classList.add('hide-avatar');
	});
}

/**
 * Shows all instances of the given avatar on the page
 */
function showAvatar(avatarUrl) {
	document.querySelectorAll('[src="' + avatarUrl + '"]').forEach(function (avatarTag) {
		avatarTag.classList.remove('hide-avatar');
	});
}