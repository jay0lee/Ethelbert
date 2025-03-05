//===========================================
//================= Launch ==================
//===========================================
//LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client
(function(){
"use strict";

/*
var msg="";
try{
	window.PageRawHTML=window.PageRawHTML||document.documentElement.outerHTML;
	if(window.top!=window){
		msg=Lang(
			 '不允许在IFrame内显示本页面，请直接通过网址访问！'
			,'This page is not allowed to be displayed in IFrame, please visit it directly through the website!');
		throw new Error();
	}
	var SupportCrypto=false;
	eval('SupportCrypto=!!crypto.subtle.sign');
	eval('``;(async function(){class a{}})');
}catch(e){
	if(!msg && !SupportCrypto && window.isSecureContext===false){
		msg=Lang('浏览器禁止不安全页面调用Crypto功能，可开启https解决，或使用localhost、file://访问', 'The browser prohibits unsafe pages from calling Crypto function. You can enable https to solve the problem, or use localhost, file:// to access');
	}
	if(!msg){
		msg=Lang('浏览器版本太低'+(SupportCrypto?'':'（不支持Crypto）')+'，请换一个浏览器再试！', 'The browser version is too low'+(SupportCrypto?'':' (Crypto is not supported)')+'. Please change another browser and try again!');
	}
	document.body.innerHTML='<div style="font-size:32px;color:red;font-weight:bold;text-align:center;padding-top:100px">'+msg+'</div>';
	return;
}
*/
$(".main").html($(".main").html()); //彻底干掉输入框自动完成
$("input,textarea,select").attr("autocomplete","off");

$(".main-load").hide();
$(".main").show();
LangClick(LangCur);

initMainUI();

})();
