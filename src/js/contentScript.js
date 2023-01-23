var uid = getUniqueId();  // every content script gets a unique id (to work with pages with multiple iframes)

var settings = {};
var defaultFlipState = {flipX:false, flipY:false, rotate:0};
var firstRun = true;
var currTarget;
var enabled = true;

// array of highlighted elements
var highlighted = [];

function getUniqueId() {
  function id4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  }

  return id4()+id4();
}

function flip(flipState, wholePage, targetUID) {
  var currFlipState = getFlipState(wholePage ? null : currTarget);
  var newState = flipState;

  // skip if requested to flip page but not in top frame
  // or requested to flip element but not the right content script
  if ((!wholePage && targetUID != uid) || (wholePage && window.top !== window)) {
    //console.log(["skip!", "page", wholePage, "win", window.top === window, uid, targetUID]);
    return;
  }
  //console.log(["flipState current vs new:", currFlipState, newState]);
  setFlipState(wholePage ? null : currTarget, newState);
  if (wholePage) {
    chrome.extension.sendRequest({command:"getFlipState", flipState:newState});
  }
}

function setFlipState(selector, state) {
  var $selector = $(selector || "body");
  var newState = state || defaultFlipState;
  // get wrapping DIV of specified elements (was needed in the past to make them transform properly)
  //if (selector && (selector.tagName == "SPAN" || selector.tagName == "A")) $selector = $selector.parent();
  $selector.toggleClass("flipthis-animate", settings.animate);
  $selector.toggleClass("flipthis-invisible", settings.animate);
  $selector.css("-webkit-transform",
    (newState.flipX ? "scaleX(-1) " : "") +
    (newState.flipY ? "scaleY(-1) " : "") +
    (newState.rotate != 0 ? "rotate(" + (newState.rotate != 270 ? newState.rotate : -90) + "deg) " : ""));
  //console.log([$selector[0], newState.rotate, "rotate(" + (newState.rotate != 270 ? newState.rotate : -90) + "deg) "]);
  $selector.removeClass("flipthis-invisible");
}

function getFlipState(selector) {
  var state = {flipX:false, flipY:false, rotate:0};
  var $selector = $(selector || "body");
  if ($selector.length) {
    // wrap specified elements into a DIV (was needed in the past to make them transform properly)
    //if (selector && (selector.tagName == "SPAN" || selector.tagName == "A") && !$selector.parent().hasClass("flipthis-wrapper")) {
    //  $selector = $selector.wrap("<div class='flipthis-wrapper'>").parent();
    //  //console.log(["wrapped", $selector]);
    //}
    var transform = $selector[0].style.webkitTransform;
    state.flipX = transform.indexOf("scaleX(-1)") >= 0;
    state.flipY = transform.indexOf("scaleY(-1)") >= 0;
    state.rotate = 0;
    var matches = transform.match(/rotate\(([+|-]?\d+)deg\)/i);
    if (matches && matches.length > 0) {
      state.rotate = (parseInt(matches[1])+360)%360;
    }
    //console.log(["webkitTransform:", $selector[0].style.webkitTransform]);
  }
  return state;
}

function processSettings(JSONsettings) {
  settings = JSON.parse(JSONsettings);
  enabled = location.href.match(new RegExp(settings.urlPattern, "i"));
  //console.log(["URL Matching:", location.href, settings.urlPattern, enabled, !!enabled]);
  chrome.extension.sendRequest({command:"enable", enabled:!!enabled});
  if (enabled && settings.autoFlip && firstRun) {
    $(document).ready(function() {
      //console.log("AutoFlip!");
      flip(settings, true);
    });
  }
  firstRun = false;
}

// initialize
function init() {

  // listen to messages sent from background and popup page
  chrome.extension.onRequest.addListener(function (request, sender, callback) {
    if (request.command == "flip") {
      //console.log("received flip");
      if (enabled) flip(request.flipState, request.wholePage, request.targetUID);
    } else if (request.command == "settings") {
      processSettings(request.settings);
    } else if (request.command == "getFlipState") {
      if (settings.contextMenu || !enabled) chrome.extension.sendRequest({command:"contextMenu", tag:null, flipState:null});
      if (enabled) chrome.extension.sendRequest({command:"getFlipState", flipState:getFlipState()});
    } else {
      callback({});
    }
  });

  // request settings
  chrome.extension.sendRequest({command: "settingsChanged"});

  $(document).ready(function() {
    //console.log("doc ready!");
  });

  // catch mouse down events to send context menu items
  document.addEventListener("mouseup", onMouseUp, false);
  document.addEventListener("mousedown", onMouseDown, false);
  document.addEventListener("mousemove", onMouseMove, false);

  console.log("Flip script injected!");
}

/* // old highlight code
function flashStep(target, origAlpha, down) {
  var alpha = parseFloat($(target).css("opacity") || "1");
  var alphaStep = origAlpha/2;
  var newAlpha = down ? alpha-alphaStep : alpha+alphaStep;
  if (newAlpha < 0) newAlpha = 0;
  if (newAlpha > origAlpha) newAlpha = origAlpha;
  $(target).css("opacity", newAlpha.toString());
  if (newAlpha <= 0) down = false;
  if (newAlpha < origAlpha) {
    setTimeout(function() { flashStep(target, origAlpha, down); }, 10);
  }
}

function flashAnimate(target) {
  var tgt = $(target);
  var origAlpha = parseFloat(tgt.css("opacity") || "1");
  tgt.addClass("flipthis-highlight");
  var t = setTimeout(function() {
    flashStep(target, origAlpha, true);
  }, 10);
  setTimeout(function() { tgt.removeClass("flipthis-highlight"); }, 100);
}*/

// send target to background
function sendTarget(target) {
  var validTarget = (target.tagName != "BODY" && target.tagName != "HTML" && target.tagName != "HEAD");

  if (target != currTarget) {
    targetFlipState = getFlipState(target);
    console.log(["Sending target flipState:", targetFlipState, target.tagName]);
    currTarget = target;
    chrome.extension.sendRequest({
      command:"contextMenu",
      remove:!enabled,
      tag:validTarget? target.tagName : null,
      flipState: JSON.stringify(targetFlipState),
      uid: uid
    });
  }
}

// highlight target (or clear all if target == null)
function highlight(target) {
  var $target = $(target);
  for (var i = highlighted.length-1; i>=0; i--) {
    highlighted[i].removeClass("flipthis-highlight");
    highlighted.splice(i);
  }
  if (target) {
    $target.toggleClass("flipthis-highlight", event.which == 3);
    highlighted.push($target);
  }
}

// send curr target and highlight
function onMouseDown(event) {
  //console.log([event.which, event.target]);
  if (enabled && event.which == 3 && settings.contextMenu) {    // right click
    sendTarget(event.target);
    if (settings.blink) highlight(event.target);
  }
}

// de-highlight
function onMouseUp(event) {
  if (enabled && event.which == 3 && settings.blink) {    // right click
    highlight(null);
  }
}

// send curr target and highlight
function onMouseMove(event) {
  //console.log(["m", highlighted.length]);
  if (enabled && event.which == 3 && settings.blink && settings.contextMenu) {    // highlight target while holding right-click
    sendTarget(event.target);
    if (settings.blink) highlight(event.target);
  }
}

// initialize
init();