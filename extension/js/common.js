//===========================================================
//================= Common functions ==================
//===========================================================
//LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client
(function(){
"use strict";

/************** Language **************/
window.LangCur=/\b(zh|cn)\b/i.test((""+navigator.language).replace(/_/g," "))?"cn":"en";
window.Lang=function(cn,en,txt){
	if((cn||en) && (!cn||!en))throw new Error("Lang bad args");
	if(txt)return LangCur=="cn"?cn:en;
	var html="",ks={cn:cn,en:en};
	for(var k in ks){
		html+=(LangCur!=k?'<!--LangHide1-->':'')
			+'<span class="lang'+k.toUpperCase()
			+'" style="'+(LangCur==k?'':'display:none')
			+'">'+ks[k]+'</span>'
			+(LangCur!=k?'<!--LangHide2-->':'');
	}
	return html;
};
window.LangReview=function(cls){
	var el=$(cls||"body");
	el.find(".langCN")[LangCur=="cn"?"show":"hide"]();
	el.find(".langEN")[LangCur!="cn"?"show":"hide"]();
	var inputs=el.find(".inputLang");
	for(var i=0;i<inputs.length;i++)
		inputs[i].setAttribute("placeholder",inputs[i].getAttribute("placeholder-"+LangCur));
};
window.LangClick=function(lang){
	LangCur=lang;
	LangReview();
	$(".langBtn").css("color",null);
	$(".langBtn_"+lang).css("color","#000");
	$("body").css("wordBreak",lang=="cn"?"break-all":null);
	
	if(!document.titleLang)document.titleLang=document.title;
	var arr=document.titleLang.split("|"),t1=[],t2=[];
	for(var i=0;i<arr.length;i++)
		if(/[^\x00-\xff]/.test(arr[i]) == (LangCur=="cn"))t1.push(arr[i].trim());
		else t2.push(arr[i].trim());
	document.title=t1.concat(t2).join(" | ");
};


/************** Console log output **************/
window.CLog=function(tag, color, msg){
	var now=new Date();
	var t=("0"+now.getMinutes()).substr(-2)
		+":"+("0"+now.getSeconds()).substr(-2)
		+"."+("00"+now.getMilliseconds()).substr(-3);
	msg=msg.replace(/<!--LangHide1[\S\s]+?LangHide2-->/g,"");//去掉没有显示的语言
	msg=msg.replace(/<[^>]+>/g,"");
	var arr=["["+t+" "+tag+"]"+msg];
	for(var i=3;i<arguments.length;i++){
		arr.push(arguments[i]);
	};
	var fn=color==1?console.error:color==3?console.warn:color==4?console.debug:console.log;
	fn.apply(console,arr);
	return msg;
};


/************** $ Selector / like jQuery **************/
(function(){
window.$=function(cls){ if(cls&&cls.is$) return cls; return new fn(cls) }
var fn=function(cls,node){
	this.length=0;
	if(!cls)return;
	if(cls.appendChild){this.push(cls); return}
	var arr=(node||document).querySelectorAll(cls);
	for(var i=0;i<arr.length;i++)this.push(arr[i]);
};
fn.prototype={
	is$:1
	,push:function(val){ this[this.length++]=val }
	,find:function(cls){ var el0=this[0]; return new fn(el0?cls:"",el0) }
	,val:function(val){ return this.prop("value",val) }
	,hide:function(){ return this.css("display","none") }
	,show:function(display){ return this.css("display",display===undefined?null:display) }
	
	,html:function(html){
		var el0=this[0];
		if(html===undefined)return el0&&el0.innerHTML||"";
		for(var i=0;i<this.length;i++) this[i].innerHTML=html;
		return this;
	}
	,append:function(html){ return this._end(html) }
	,prepend:function(html){ return this._end(html,1) }
	,_end:function(html,prep){
		var el0=this[0];
		if(html && el0){
			var nodes=html;
			if(typeof(html)=="string"){
				var div=document.createElement("div");
				div.innerHTML=html;
				nodes=[];
				for(var i=0;i<div.childNodes.length;i++)nodes.push(div.childNodes[i]);
			}else if(html.appendChild){
				nodes=[html];
			}
			if(prep)prep=el0.firstChild;
			for(var i=0;i<nodes.length;i++){
				if(prep) el0.insertBefore(nodes[i],prep);
				else el0.appendChild(nodes[i])
			}
		}
		return this;
	}
	,prop:function(key,val){
		var el0=this[0];
		if(val===undefined)return el0&&el0[key];
		for(var i=0;i<this.length;i++) this[i][key]=val;
		return this;
	}
	,attr:function(key,val){
		var el0=this[0];
		if(val===undefined)return el0&&el0.getAttribute(key);
		for(var i=0;i<this.length;i++){
			if(val==null) this[i].removeAttribute(key);
			else this[i].setAttribute(key,val);
		}
		return this;
	}
	,css:function(key,val){
		for(var i=0;i<this.length;i++)
			this[i].style[key]=val;
		return this;
	}
	,bind:function(type,fn){
		for(var i=0;i<this.length;i++)
			this[i].addEventListener(type,fn);
		return this;
	}
};
})();


/************** functions **************/
window.FormatText=function(str){
	return str.replace(/[&<>='"]/g,function(a){ return "&#" + a.charCodeAt(0) + ";" });
};

window.Str2Bytes=function(str){
	str=unescape(encodeURIComponent(str));
	var u8arr=new Uint8Array(str.length);
	for(var i=0;i<str.length;i++)u8arr[i]=str.charCodeAt(i);
	return u8arr;
};
window.Bytes2Str=function(bytes){
	var str="";
	for(var i=0;i<bytes.length;i++) str+=String.fromCharCode(bytes[i]);
	return decodeURIComponent(escape(str));
};
window.Json2UrlB64=function(data){
	return Bytes2UrlB64(JSON.stringify(data));
};
window.Base642Bytes=function(b64){
	var str=atob(b64);
	var u8arr=new Uint8Array(str.length);
	for(var i=0;i<str.length;i++)u8arr[i]=str.charCodeAt(i);
	return u8arr;
};
window.UrlB642Bytes=function(str){
	str=str.replace(/_/g,"\/").replace(/-/g,"+");
	while(str.length%4)str+="=";
	return Base642Bytes(str);
};
window.Bytes2UrlB64=function(bytes){//二进制数组转成url base64
	return Bytes2Base64(bytes).replace(/\//g,"_").replace(/\+/g,"-").replace(/=/g,"");
};
window.Bytes2Base64=function(bytes){
	var str="";
	if(typeof(bytes)=="string"){
		str=unescape(encodeURIComponent(bytes));
	}else{
		if(bytes instanceof ArrayBuffer) bytes=new Uint8Array(bytes);
		for(var i=0;i<bytes.length;i++) str+=String.fromCharCode(bytes[i]);
	}
	return btoa(str);
};

})();
