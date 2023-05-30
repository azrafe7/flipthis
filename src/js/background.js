'use strict';

// settings
var defaults = {};
var settings = {};

// flip states
var defaultFlipState = {flipX:false, flipY:false, rotate:0};
var nextFlipState = {};
var currentFlipState = {};
var targetFlipState = {};

var targetUID;

var canvas;

// icon images
var iconBtn;
var fNow;
var fNext;

// context menu ids
var pageMenuId;
var elementMenuId;
var targetMenuId;
var contextMenuItems = [];

console.log("Flip extension started");
init();


function isEmpty(obj) {
  if (obj) {
    for (let p in obj) {
      return false;
    }
  }
  return true;
}


function contextMenuOnClick(info, tab) {
  var currFlipState = {};
  var onPage = info.parentMenuItemId == pageMenuId;
  if (onPage) {
    currFlipState = currentFlipState;
  } else {
    currFlipState = targetFlipState;
  }
  var clickedIdx = contextMenuItems.indexOf(info.menuItemId) % 7;
  switch (clickedIdx) {
    case 0:
      currFlipState.flipX = !currFlipState.flipX;
      break;
    case 1:
      currFlipState.flipY = !currFlipState.flipY;
      break;
    case 2:
    case 3:
    case 4:
    case 5:
      currFlipState.rotate = (clickedIdx-2)*90;
      break;
    case 6:
      currFlipState = defaultFlipState;
      break;
    default:
      break;
  }
  console.log(["onPage:"+onPage, currFlipState]);
  sendFlip(tab.id, currFlipState, onPage, targetUID);
}


function setFlippedIcon(currFlipState, newFlipState, id) {
  console.log(["Setting icon with flipState:", currFlipState, newFlipState, id]);
  if (currFlipState) {
    var ctx = canvas.getContext("2d", { willReadFrequently: true });

    ctx.drawImage(iconBtn, 0,0);  // icon button

    // current flip state icon
    ctx.save();
    ctx.translate(10,10);
    ctx.rotate(currFlipState.rotate*Math.PI/180);
    ctx.scale(currFlipState.flipX ? -1 : 1, currFlipState.flipY ? -1 : 1);
    ctx.translate(-10,-10);
    ctx.drawImage(fNow, 3,3);
    ctx.restore();

    // next flip state icon
    ctx.save();
    ctx.translate(10,10);
    ctx.rotate(newFlipState.rotate*Math.PI/180);
    ctx.scale(newFlipState.flipX ? -1 : 1, newFlipState.flipY ? -1 : 1);
    ctx.translate(-10,-10);
    ctx.drawImage(fNext, 3,3);
    ctx.restore();

    chrome.browserAction.setIcon({imageData:ctx.getImageData(0,0,19,19), tabId: id});
  } else {  // set disabled icon
    chrome.browserAction.setIcon({path:'icons/icon-19.png', tabId: id});
  }
}

function sendFlip(tabId, nextFlipState, page) {
    chrome.tabs.sendRequest(tabId, {command:"flip", flipState:nextFlipState, wholePage:page, targetUID:targetUID});
}

function getNextFlipState(flipState) {
  var newFlipState = (flipState.flipX == settings.flipX && flipState.flipY == settings.flipY && flipState.rotate == settings.rotate) ? defaultFlipState : settings;
  return newFlipState;
}

// initialize
function init() {

  // create canvas element
  canvas = document.createElement('canvas');
  canvas.setAttribute('width', 19);
  canvas.setAttribute('height', 19);

  // settings defaults
  defaults.autoFlip = false;
  defaults.flipX = false;
  defaults.flipY = false;
  defaults.rotate = 180;
  defaults.animate = true;
  defaults.contextMenu = true;
  defaults.blink = false;
  defaults.prioritizeMedia = false;
  defaults.forceInlineBlock = false;
  defaults.urlPattern = "";

  // save default settings to local storage
  localStorage.defaults = JSON.stringify(defaults);

  // load settings from local storage
  if (!isEmpty(localStorage.settings)) {
    settings = JSON.parse(localStorage.settings);
    for (let prop in defaults) {
      if (settings[prop] == undefined) {  // load default when not defined
        settings[prop] = defaults[prop];
      }
    }
  } else {
    settings = defaults;
  }

  // preload icon images
  iconBtn = new Image(19,19);
  iconBtn.src = "icons/icon-btn.png";
  fNow = new Image(6,11);
  fNow.src = "icons/f-now.png";
  fNext = new Image(6,11);
  fNext.src = "icons/f-next.png";

  // save settings
  localStorage.settings = JSON.stringify(settings);
  console.log(["Settings loaded:", settings]);

  // listen to messages sent from extension's other pages
  chrome.extension.onRequest.addListener(function (request, sender, callback) {
    if (request.command == "settingsChanged") {
      settings = JSON.parse(localStorage.settings);
      console.log(["Sending settings after request:", settings]);
      // send settings to all tabs
      chrome.tabs.getAllInWindow(null, function(tabs) {
        tabs.forEach(function(tab) {
          chrome.tabs.sendRequest(tab.id, {command:"settings", settings:JSON.stringify(settings)});
        });
      });
      if (!settings.contextMenu) {
        chrome.contextMenus.removeAll();
      }
    } else if (request.command == "getFlipState") {
      currentFlipState = request.flipState;
      nextFlipState = getNextFlipState(currentFlipState);
      setFlippedIcon(currentFlipState, nextFlipState, sender.tab.id);
    } else if (request.command == "enable") {
      var enabled = request.enabled;
      console.log(["Received enable:", enabled, sender.tab.id]);
      if (!enabled) {
        setFlippedIcon(null, null, sender.tab.id);
      }
    } else if (request.command == "contextMenu") {
      chrome.contextMenus.removeAll(function() {
        contextMenuItems = [];
        if (!request.remove) {
          if (request.tag) {
            targetFlipState = JSON.parse(request.flipState);
            targetUID = request.uid;
            console.log(["Received target:", request.tag, targetFlipState]);
            const allButActionsContexts = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];

            chrome.contextMenus.create({title:"<"+request.tag+"> element...", contexts:allButActionsContexts, enabled:false});
            chrome.contextMenus.create({type:"separator", contexts:allButActionsContexts});
            contextMenuItems.push(chrome.contextMenus.create({title:"Flip Horizontally", contexts:allButActionsContexts, type:"checkbox", checked:targetFlipState.flipX, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Flip Vertically", contexts:allButActionsContexts, type:"checkbox", checked:targetFlipState.flipY, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 0\u00b0", contexts:allButActionsContexts, type:"radio", checked:targetFlipState.rotate == 0, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate +90\u00b0", contexts:allButActionsContexts, type:"radio", checked:targetFlipState.rotate == 90, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 180\u00b0", contexts:allButActionsContexts, type:"radio", checked:targetFlipState.rotate == 180, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate -90\u00b0", contexts:allButActionsContexts, type:"radio", checked:targetFlipState.rotate == 270, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Reset", contexts:allButActionsContexts, onclick:contextMenuOnClick}));
            chrome.contextMenus.create({type:"separator", contexts:allButActionsContexts});

            // browser action element submenu
            elementMenuId = chrome.contextMenus.create({title:"<"+request.tag+"> element...", contexts:["browser_action"]}, function() {
                //chrome.contextMenus.create({type:"separator", contexts:["browser_action"], parentId:elementMenuId});
                contextMenuItems.push(chrome.contextMenus.create({title:"Flip Horizontally", contexts:["browser_action"], type:"checkbox", checked:targetFlipState.flipX, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Flip Vertically", contexts:["browser_action"], type:"checkbox", checked:targetFlipState.flipY, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 0\u00b0", contexts:["browser_action"], type:"radio", checked:targetFlipState.rotate == 0, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Rotate +90\u00b0", contexts:["browser_action"], type:"radio", checked:targetFlipState.rotate == 90, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 180\u00b0", contexts:["browser_action"], type:"radio", checked:targetFlipState.rotate == 180, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Rotate -90\u00b0", contexts:["browser_action"], type:"radio", checked:targetFlipState.rotate == 270, parentId:elementMenuId, onclick:contextMenuOnClick}));
                contextMenuItems.push(chrome.contextMenus.create({title:"Reset", contexts:["browser_action"], parentId:elementMenuId, onclick:contextMenuOnClick}));
                //chrome.contextMenus.create({type:"separator", contexts:["browser_action"], parentId:elementMenuId});
            });
          }
          pageMenuId = chrome.contextMenus.create({title:request.tag ? "Whole page..." : "Flip this page...", contexts:["all"]}, function() {
            contextMenuItems.push(chrome.contextMenus.create({title:"Flip Horizontally", contexts:["all"], type:"checkbox", checked:currentFlipState.flipX, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Flip Vertically", contexts:["all"], type:"checkbox", checked:currentFlipState.flipY, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 0\u00b0", contexts:["all"], type:"radio", checked:currentFlipState.rotate == 0, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate +90\u00b0", contexts:["all"], type:"radio", checked:currentFlipState.rotate == 90, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate 180\u00b0", contexts:["all"], type:"radio", checked:currentFlipState.rotate == 180, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Rotate -90\u00b0", contexts:["all"], type:"radio", checked:currentFlipState.rotate == 270, parentId:pageMenuId, onclick:contextMenuOnClick}));
            contextMenuItems.push(chrome.contextMenus.create({title:"Reset", contexts:["all"], parentId:pageMenuId, onclick:contextMenuOnClick}));
          });
        }
      });
    } else {
      callback({});
    }
  });

  // request flip state when changing tab
  chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
    chrome.tabs.sendRequest(tabId, {command:"getFlipState"});
  });

  // request flip state when updating tab
  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    chrome.tabs.sendRequest(tabId, {command:"getFlipState"});
  });

  // send request to contentscript when extension icon is clicked
  chrome.browserAction.onClicked.addListener(function(tab) {
    sendFlip(tab.id, nextFlipState, true);
  });
}

