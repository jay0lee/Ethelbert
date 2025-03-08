manifest = chrome.runtime.getManifest();
var ExtVersion = manifest.version;
var ExtName = manifest.name;
document.title = ExtName;
console.log(ExtName + " " + ExtVersion);
console.log("LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client/blob/main/LICENSE");
