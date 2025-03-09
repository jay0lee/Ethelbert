//===================================================
//================= ACME functions ==================
//===================================================
//LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client
(function(){
"use strict";

True = function() {};
False = function() {};

/************** ACME client implementation **************/
//RFC8555: https://www.rfc-editor.org/rfc/rfc8555.html
window.ACME={
	URL: ""
	,SyncID: 0
	,DirData: {}
	,Directory:function(True,False) {
		var id =++ ACME.SyncID;
		var url = ACME.URL, dirStoreKey = "ACME_HTML_cache_" + url;
		var ok = function(cache) {
			var data = cache.data;
			if (id != ACME.SyncID) return False("cancel");
			var meta = data.meta || {};
			if (!data.newOrder)
				return False("Not newOrder found: " + FormatText(JSON.stringify(data)));
			ACME.DirData = data;
			ACME.StepData.termsURL = meta.termsOfService;
			ACME.StepData.needEAB = !!meta.externalAccountRequired;
			var saveCache = function() {
				localStorage[dirStoreKey] = JSON.stringify(cache);
			};
			saveCache();
			True(cache,saveCache);
		};
		var cache = JSON.parse(localStorage[dirStoreKey] || '{}');
		if (cache.time && Date.now() - cache.time < 24*60*60*1000) {
			return ok(cache);
		}
		request(url, null, function(data) {
			ok({data:data, time:Date.now()});
		},False);
	}
	
	,StepData:{}
	,ChallName:function(chall) {
		if (chall.type == "dns-01") { // https://letsencrypt.org/docs/challenge-types/
			return "DNS Verify";
		} else if (chall.type == "http-01") {
			return "File URL Verify";
		} // tls-alpn-01 https://www.rfc-editor.org/rfc/rfc8737
		return chall.type.toUpperCase();
	}
	,ChallSort:function(chall) {
		if (chall.type == "dns-01") return 1+"_" + chall.type;
		else if (chall.type == "http-01") return 2+"_" + chall.type;
		return 3 + "_" + chall.type;
	}
	// JSON Web Signature(JWS)
	,GetJwsA:async function (Protected, Payload) {
		var key = ACME.StepData.config.accountKey;
		var alg = "ES256", algorithm = {name:"ECDSA", hash:"SHA-256"};
		if (key.type == "RSA") {
			alg = "RS256"; algorithm = {name: "RSASSA-PKCS1-v1_5"}
		}
		Protected.alg = alg;
		var rtv = {
			"protected": Json2UrlB64(Protected)
			,payload: Payload?Json2UrlB64(Payload): ""
		};
		var data = Str2Bytes(rtv["protected"] + "." + rtv.payload);
		var sign = await crypto.subtle.sign(algorithm, key.key, data);
		rtv.signature = Bytes2UrlB64(sign);
		return rtv;
	}
	// Nonce
	,GetNonceA:async function(useNew) {
		return new Promise(function(resolve,reject){
			ACME.GetNonce(useNew,function(val){
				resolve(val);
			},function(err){
				reject(new Error(err));
			});
		});
	}
	,GetNonce:function(useNew, True, False){
		var old=ACME.PrevNonce;ACME.PrevNonce="";
		if(!useNew && old) return True(old);//使用上次调用返回的值
		request({url:ACME.DirData.newNonce
			,method:"HEAD",response:false
		}, null, function(data,xhr){
			ACME.PrevNonce="";
			//跨域无解 Chrome ZeroSSL: Refused to get unsafe header "Replay-Nonce" , 需要 Access-Control-Expose-Headers: Link, Replay-Nonce, Location
			var val=xhr.getResponseHeader("Replay-Nonce");
			if(!val){
				False("GetNonce: "+Lang('此ACME服务对浏览器访问支持太差，无法跨域获取Replay-Nonce响应头。','This ACME service has too poor browser access support to get the Replay-Nonce response header across domains.'), true);
				return;
			}
			True(val);
		},function(err){
			False("GetNonce: "+err);
		});
	}
	//测试账户接口的跨域访问
	,TestAccountCORS:function(True,False){
		request({url:ACME.DirData.newAccount
			,method:"POST",response:false,nocheck:true
		}, {}, function(data,xhr){
			if(xhr.status>0){
				True();
			}else{
				False("["+xhr.status+"]",true);
			}
		},function(err){
			False(err);
		});
	}
	
	//账户接口调用
	,StepAccount:async function(True,False){
		var id=++ACME.SyncID;
		var tag="ACME.StepAccount";
		CLog(tag, 0, "==========Account Start==========");
		var Err="";
		try{
			await ACME._StepAccountA(id,tag);
		}catch(e){
			Err=e.message||"-";
			CLog(tag, 1, Err, e);
		}
		CLog(tag, 0, "==========Account End==========");
		if(Err) False(Err)
		else True();
	} , _StepAccountA:async function(id,tag){
		var url=ACME.DirData.newAccount,config=ACME.StepData.config;
		var accountData={
			contact:["mailto:"+config.email]
			,termsOfServiceAgreed:true
		};
		
		//externalAccountRequired https://github.com/fszlin/certes/blob/08bf850bbed9e026c718f56f1bcc454afafb4f92/src/Certes/Acme/AccountContext.cs
		if(ACME.StepData.needEAB){
			var eab={
				"protected":Json2UrlB64({ alg:"HS256", kid:config.eabKid, url:url })
				,payload:Json2UrlB64(X509.PublicKeyJwk(config.accountKey))
			};
			var key=await crypto.subtle.importKey("raw", UrlB642Bytes(config.eabKey)
				,{name:"HMAC",hash:"SHA-256"}, true, ["sign"]);
			var data=Str2Bytes(eab["protected"]+"."+eab.payload);
			var sign=await crypto.subtle.sign("HMAC", key, data);
			eab.signature=Bytes2UrlB64(sign);
			accountData.externalAccountBinding=eab;
			CLog(tag,0 ,"externalAccountBinding", eab);
		};
		
		//组装成jws，请求接口
		var sendData=await ACME.GetJwsA({
			jwk: X509.PublicKeyJwk(config.accountKey)
			,nonce: await ACME.GetNonceA(true)
			,url: url
		},accountData);
		var resp=await requestA(url, sendData);
		if(id!=ACME.SyncID) throw new Error("cancel");
		ACME.StepData.account={
			url:xhrHeader(resp.xhr, "Location")
			,data:resp.data
		};
		CLog(tag,0,"Account OK",ACME.StepData.account);
	}
	
	//订单接口调用
	,StepOrder:async function(Progress,True,False){
		var id=++ACME.SyncID;
		var tag="ACME.StepOrder";
		CLog(tag, 0, "==========Order Start==========");
		var Err="";
		try{
			await ACME._StepOrderA(Progress,id,tag);
		}catch(e){
			Err=e.message||"-";
			CLog(tag, 1, Err, e);
		}
		CLog(tag, 0, "==========Order End==========");
		if(Err) False(Err)
		else True();
	} , _StepOrderA:async function(Progress,id,tag){
		var url = ACME.DirData.newOrder, config = ACME.StepData.config;
		var sn = await chrome.enterprise.deviceAttributes.getDeviceSerialNumber();
		var orderData = {"identifiers": [{"type": "permanent-identifier",
		                              "value": sn}],
			      "notBefore": "0001-01-01T00:00:00Z",
			      "notAfter":"0001-01-01T00:00:00Z"};
		
		Progress("newOrder...");
		var sendData=await ACME.GetJwsA({
			kid: ACME.StepData.account.url
			,nonce: await ACME.GetNonceA()
			,url: url
		},orderData);
		var resp=await requestA(url, sendData);
		if(id!=ACME.SyncID) throw new Error("cancel");
		resp.data.orderUrl=xhrHeader(resp.xhr, "Location");
		ACME.StepData.order=resp.data;
		CLog(tag,0,"Order OK",ACME.StepData.order);
		
		//准备Key Authorizations需要的参数 参考：rfc8555 8.1
		var jwkStr=JSON.stringify(X509.PublicKeyJwk(config.accountKey));
		var thumbprint=await crypto.subtle.digest({name: "SHA-256"}, Str2Bytes(jwkStr));
		thumbprint=Bytes2UrlB64(thumbprint);
		
		//读取所有的验证信息
		var idfs = ACME.StepData.order.identifiers, bad=0;
		var auths=ACME.StepData.order.authorizations;
		for(var i=0;i<idfs.length;i++){
			if(config.domains.indexOf(idfs[i].value)==-1) bad=1;
		}
		if (bad) {
			console.log('BAD BAD BAD');
		}
		if (idfs.length != auths.length) {
			console.log('IDFS not equal to AUTHS length.');
		}
		if (idfs.length != config.domains.length) {
			console.log('IDFS not equal to CONFIG.DOMAINS length');
		}
		if (bad ||
		    idfs.length != auths.length ||
		    idfs.length != config.domains.length) {
			console.log("bad: ");
		        console.log(bad);
		        console.log("idfs:");
		        console.log(idfs);
		        console.log("config.domains: ");
		        console.log(config.domains);
		        console.log("auths");
		        console.log(auths);
			throw new Error("The domain name in the created order is inconsistent with the configuration");
		}
		if(id!=ACME.SyncID) throw new Error("cancel");
		ACME.StepData.auths={};
		for(var i=0;i<auths.length;i++){
			Progress("auth("+(i+1)+"/"+auths.length+")...");
			var url=auths[i];
			var sendData=await ACME.GetJwsA({
				kid: ACME.StepData.account.url
				,nonce: await ACME.GetNonceA()
				,url: url
			},"");
			var resp=await requestA(url, sendData);
			if(id!=ACME.SyncID) throw new Error("cancel");
			resp.data.domain=idfs[i].value;
			resp.data.authUrl=url;
			ACME.StepData.auths[idfs[i].value]=resp.data;
			
			//生成Key Authorizations
			var challs=resp.data.challenges;
			for(var i2=0;i2<challs.length;i2++){
				var chall=challs[i2];
				chall.authTxt=chall.token+"."+thumbprint;
				var sha=await crypto.subtle.digest({name: "SHA-256"}
								, Str2Bytes(chall.authTxt));
				if(id!=ACME.SyncID) throw new Error("cancel");
				chall.authTxtSHA256=Bytes2UrlB64(sha);
				chall.authTxtSHA256Base64=Bytes2Base64(sha);
			}
		}
		CLog(tag,0,"Order Authorizations",ACME.StepData.auths);
	}
	
	,StepVerifyAuthItem:async function(authItem, challIdx, True,False){
		var tag="ACME.verify["+authItem.challenges[challIdx].type+"]:"+authItem.domain;
		var Err="";
		try{
			await ACME._StepVerifyAuthItemA(authItem,challIdx, ACME.SyncID,tag, True,False);
		}catch(e){
			Err=e.message||"-";
			CLog(tag, 1, Err, e);
		}
		if(Err) True(false, 1000, Err);
	} , _StepVerifyAuthItemA:async function(authItem,challIdx, id,tag, True,False){
		var chall = authItem.challenges[challIdx];
		var config = ACME.StepData.config;
		if(!chall.isSend){
			var url=chall.url;
			var sendData=await ACME.GetJwsA({
				kid: ACME.StepData.account.url
				,nonce: await ACME.GetNonceA()
				,url: url
			},{attObj: window.challenge_response});
			var resp=await requestA({url:url,nocheck:true}, sendData);
			var status=resp.xhr.status;
			if(status>=200&&status<300)
				chall.isSend=true;
		}
		
		var url = authItem.authUrl;
		var sendData = await ACME.GetJwsA({
			kid: ACME.StepData.account.url
			,nonce: await ACME.GetNonceA()
			,url: url
		},"");
		var resp = await requestA(url, sendData);
		var data=resp.data;
		if (data.status == "pending") {
			CLog(tag, 0, "pending...");
                        return True(false, 1000, "pending...");
		}
		if (data.status == "valid") {
			CLog(tag, 0, "valid OK");
			return True(true);
		}
		CLog(tag, 1, "Fail", data);
		//return False(data.status+": "+FormatText(JSON.stringify(data)));
		return True(false, 1000, data.status+": "+FormatText(JSON.stringify(data)));
	}
	
	//完成订单，生成证书
	,StepFinalizeOrder:async function(Progress,True,False){
		var id=++ACME.SyncID;
		var tag="ACME.StepFinalizeOrder";
		CLog(tag, 0, "==========Finalize Start==========");
		var Err="";
		try{
			await ACME._StepFinalizeOrderA(Progress,id,tag);
		}catch(e){
			Err=e.message||"-";
			CLog(tag, 1, Err, e);
		}
		CLog(tag, 0, "==========Finalize End==========");
		if(Err) False(Err)
		else True();
	} , _StepFinalizeOrderA:async function(Progress,id,tag){
		var order=ACME.StepData.order,config=ACME.StepData.config,domains=config.domains;
		
		//先请求finalize
		if(!order.finalizeIsSend){
			Progress("finalize...");
			var csr = await new Promise(function(resolve,reject){
				X509.CreateCSR(config.privateKey, domains[0], domains, function(csr){
					resolve(csr);
				},function(err){
					reject(new Error(err));
				});
			});
			order.orderCSR = csr;
			CLog(tag,0,"CSR\n"+csr);
			csr = Bytes2UrlB64(ASN1.PEM2Bytes(csr));
			
			var url = order.finalize;
			var sendData = await ACME.GetJwsA({
				kid: ACME.StepData.account.url
				,nonce: await ACME.GetNonceA()
				,url: url
			},{ csr:csr });
			var resp = await requestA(url, sendData);
			if(id!=ACME.SyncID) throw new Error("cancel");
			CLog(tag,0,"finalize result",resp.data);
			order.finalizeIsSend=true;
		}
		
		var t1=Date.now(),tryCount=0;
		while(!order.checkOK && Date.now()-t1<60*1000){
			if(id!=ACME.SyncID) throw new Error("cancel");
			tryCount++;
			Progress("check retry:"+tryCount+"...");
			var url=order.orderUrl;
			//组装成jws，请求接口
			var sendData=await ACME.GetJwsA({
				kid: ACME.StepData.account.url
				,nonce: await ACME.GetNonceA()
				,url: url
			},"");
			var resp=await requestA(url, sendData);
			if(id!=ACME.SyncID) throw new Error("cancel");
			var data=resp.data;
			if(data.status=="valid"){
				order.checkOK=true;
				order.certUrl=data.certificate;
				CLog(tag,0,"check OK",data);
				break;
			}else if(data.status=="invalid"){
				CLog(tag,1,"check Fail",data);
				throw new Error(data.status+": "+FormatText(JSON.stringify(data)));
			}else{
				CLog(tag,0,data.status+"... wait 1s",data);
				await new Promise(function(s){ setTimeout(s, 1000) });
			}
		}
		
		//下载证书
		if(!order.downloadPEM){
			Progress("download...");
			var url=order.certUrl;
			//组装成jws，请求接口
			var sendData=await ACME.GetJwsA({
				kid: ACME.StepData.account.url
				,nonce: await ACME.GetNonceA()
				,url: url
			},"");
			var resp=await requestA({url:url,response:false}, sendData);
			if(id!=ACME.SyncID) throw new Error("cancel");
			var pem=resp.xhr.responseText;
			order.downloadPEM=pem;
			CLog(tag,0,"download OK\n"+pem);
		}
	}
};


// 读取响应头，读不到就当做跨域无法读取处理，自定义的头需要 Access-Control-Expose-Headers: Link, Replay-Nonce, Location
var xhrHeader=function(xhr,key){
	var val=xhr.getResponseHeader(key);
	if(!val){
		acmeReadDirGotoCORS();
		throw new Error(Lang("无法读取响应头"+key+"，可能是因为此ACME服务对跨域访问支持不良，请按第一步显示的提示操作。"
			,"The response header "+key+" cannot be read, This may be because this ACME service does not support cross domain access, Please follow the prompt displayed in step 1."));
	}
	return val;
};

// ajax
var requestA=function(url,post){
	return new Promise(function(resolve,reject){
		console.log('URL:');
		console.log(url);
		console.log('POST:');
		console.log(post);
		request(url,post,function(data,xhr){
			resolve({data:data,xhr:xhr});
		},function(err){
			reject(new Error(err));
		});
	});
}
var request=function(url,post,True,False){
	var set=typeof(url)=="string"?{url:url}:url; url=set.url;
	var method=set.method||(post?"POST":"GET");
	var tag="ACME.Request";
	
	var xhr=new XMLHttpRequest();
	xhr.timeout=30000;
	xhr.open(method,url,true);
	xhr.onreadystatechange=function(){
		if(xhr.readyState==4){
			ACME.PrevNonce=xhr.getResponseHeader("Replay-Nonce")||"";//将此值存起来
			
			var isBad=xhr.status<200 || xhr.status>=300;
			var useResp=set.response==null || set.response;
			var err="",data,logObj;
			if(useResp || isBad){
				logObj=xhr.responseText;
				try{
					data=JSON.parse(logObj);
					logObj=data;
				}catch(e){ };
			}
			if(set.nocheck || !isBad && (!useResp || data)){
				return True(data, xhr);
			}
			False((isBad?"["+xhr.status+"]":"")+FormatText(xhr.responseText), xhr.status);
		}
	};
	if(post){
		if(typeof(post)=="object")post=JSON.stringify(post);
		xhr.setRequestHeader("Content-Type",set.contentType||"application/jose+json");
		xhr.send(post);
	}else{
		xhr.send();
	}
};

})()
