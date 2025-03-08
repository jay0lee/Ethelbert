var manifest = await chrome.runtime.getManifest();
var Version = manifest.version;
var ExtName = manifest.name;
console.log(ExtName + " " Version);
console.log("LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client/blob/main/LICENSE");
