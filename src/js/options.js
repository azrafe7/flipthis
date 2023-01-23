
var bgPage = chrome.extension.getBackgroundPage();  // ref to background page object

var extensionUrl = "https://chrome.google.com/extensions/search?hl=en&q=";
var manifest = {};  // extension manifest object
var author = "azrafe7";
var settingsHelper = {};
var settings = {};

// SettingsHelper Object
SettingsHelper = function() {
  return this;
}

SettingsHelper.prototype = {

  getFromDisk: function() {
    settings = JSON.parse(localStorage.settings);
  },

  getFromPage: function() {
    settings.autoFlip = $("#autoFlip").attr("checked");
    settings.flipX = $("#flipX").attr("checked");
    settings.flipY = $("#flipY").attr("checked");
    settings.rotate = $("#rotate").val();
    settings.animate = $("#animate").attr("checked");
    settings.contextMenu = $("#contextMenu").attr("checked");
    settings.blink = $("#blink").attr("checked");
    settings.urlPattern = $("#urlPattern").val();
  },

  saveToPage: function() {
    $("#autoFlip").attr("checked", settings.autoFlip);
    $("#flipX").attr("checked", settings.flipX);
    $("#flipY").attr("checked", settings.flipY);
    $("#rotate").val(settings.rotate);
    $("#animate").attr("checked", settings.animate);
    $("#contextMenu").attr("checked", settings.contextMenu);
    $("#blink").attr("checked", settings.blink);
    $("#urlPattern").val(settings.urlPattern);
  },

  saveToDisk: function() {
    localStorage.settings = JSON.stringify(settings);
  },

  setDefaults: function() {
    settings = JSON.parse(localStorage.defaults);
  }
}



init();  // initialize

// execute main() when DOM is ready
$(document).ready(main);


// initialize
function init() {
  settingsHelper = new SettingsHelper();
  settingsHelper.getFromDisk();   // load settings from disk
}

// main function (executed when the DOM is ready)
function main() {
  // read manifest and write extension title & ver & desc
  readManifestFile();

  settingsHelper.saveToPage();

  $("input,select").bind("change", function() { sendSettings(); });
}


function sendSettings() {
  settingsHelper.getFromPage();
  settingsHelper.saveToDisk();
  chrome.extension.sendRequest({command: "settingsChanged"});
  console.log(["Sending new settings:", settings]);
}


// read manifest file and put parsed object in manifest global variable
function readManifestFile() {
  xhr = new XMLHttpRequest();
  xhr.open("GET", chrome.extension.getURL("manifest.json"));
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4) {
      manifest = JSON.parse(xhr.responseText);
      $("#title").text(manifest.name + " v" + manifest.version + " - Options");
    }
  }
  xhr.send();
}

