//=================================================
//================= UI functions ==================
//=================================================
//LICENSE: GPL-3.0,

(function(){
"use strict";
var ChoiceAcmeURLStoreKey="ACME_HTML_choice_acmeURL";
var InputDomainsStoreKey="ACME_HTML_input_domains";
var InputEmailStoreKey="ACME_HTML_input_email";
var DropConfigFile={};

var domains;
chrome.enterprise.deviceAttributes.getDeviceSerialNumber(function(sn) {
	domains = [sn];
});

var email;
chrome.identity.getProfileUserInfo(function(id) {
	email = id.email;
});

// defaults
var algorithm_choices = ['ecc', 'rsa'];
var api_choices = ['v2', 'v1'];
var key_choices = ['machine', 'user'];
var register_token_choices = [true, false];
window.algorithm = algorithm_choices[0];
window.api_ver = api_choices[0];
var ca_url = 'https://ca.example.com/acme/acme/directory';
window.register_token = register_token_choices[0];
window.user_or_machine_key = key_choices[0];
chrome.storage.managed.get(['algorithm',
			    'api_ver',
			    'ca_url',
			    'register_token',
			    'user_or_machine_key']).then((data) => {
    console.log('managed data:');
    console.log(data);
    if (algorithm_choices.includes(data.algorithm.toLowerCase())) {
        window.algorithm = data.algorithm.toLowerCase();
    } else {
	console.log('ERROR: ' + data.algorithm + 'is not one of the valid algorithms of ( ' +
		    algorithm_choices.join(', ') + ' ). Using default value of ' +
		    algorithm_choices[0]);
    }
    if (api_choices.includes(data.api_ver.toLowerCase())) {
        window.api_ver = data.api_ver.toLowerCase();
    } else {
	console.log('ERROR: ' + data.api_ver + ' is not one of the valid API versions of ( ' +
		    api_choices.join(', ') + ' ). Using default value of ' +
		    api_choices[0]);
    }
    if (data.register_token == true) {
	window.register_token = true;
    } else if (data.register_token == false) {
	window.register_token = false;
    } else {
	console.log('ERROR: ' + data.register_token + ' is true or false, the only valid values for register_token');
    }
    if (key_choices.includes(data.user_or_machine_key.toLowerCase())) {
        window.user_or_machine_key = data.user_or_machine_key.toLowerCase();
    } else {
	console.log('ERROR: ' + data.user_or_machine_key + 'is not one of the valid key choices of ( ' +
		    key_choices.join(', ') + ' ). Using default value of ' +
		    key_choices[0]);
    }
    window.api_ver = data.api_ver.toLowerCase();
    ca_url = data.ca_url;
    window.user_or_machine_key = data.user_or_machine_key.toLowerCase();
});

function decodestr2ab(str) {
    let binary_string =  window.atob(str);
    let len = binary_string.length;
    let bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
};

/************** UI: Initialize on Launch **************/
window.initMainUI=function(){
	$(".eccCurveNames").html(X509.SupportECCType2Names().join(Lang("、",", ")));
	$(".versionBox").html(ExtVersion);
	$(".clientName").html(ExtName);
	
	if(/mobile/i.test(navigator.userAgent)){
		$(".main").prepend($(".langBtnBox").css("position",null));
		$(".donateWidget").css("position",null);
	}
	
	initTest_Restore();
	acmeReadDirGotoCORSInit();
	downloadFileNameShow();
	initStep4();
};

var NextStepTips=function(){
	return '<span style="font-size:24px;font-weight:bold;">'+Lang("请进行下一步操作。"," Please proceed to the next step.")+'</span>';
};
var PleaseWaitTips=function(){
	return Lang(" 请稍候... "," Please wait... ");
};
var TryAgainTips=function(){
	return Lang(" 请重试！"," Please try again! ");
};
var ShowState=function(elem,msg,color,tag){
	var now=new Date();
	var t=("0"+now.getHours()).substr(-2)
		+":"+("0"+now.getMinutes()).substr(-2)
		+":"+("0"+now.getSeconds()).substr(-2);
	$(elem).html(msg===false?'':'<div style="color:'+(!color?"":color==1?"red":color==2?"#0b1":color==3?"#fa0":color)+'">'+(tag==null?'['+t+'] ':tag)+msg+'</div>');
	return msg;
};
window.Toast=function(msg,color,time){
	ShowState(".toastState",msg,color,"");
	
	$(".toastState").show();
	clearTimeout(Toast._int);
	Toast._int=setTimeout(function(){ $(".toastState").hide(); }, time||5000);
};
window.onerror=function(message, url, lineNo, columnNo, error){
	//https://www.cnblogs.com/xianyulaodi/p/6201829.html
	Toast('【Uncaught Error】'+message+'<pre>'+"at:"+lineNo+":"+columnNo+" url:"+url+"\n"+(error&&error.stack||"-")+'</pre>',1,15000);
};

var UserClickSyncID=0;
var UserClickSyncKill=function(id,tag,msg){
	if(id!=UserClickSyncID){
		var abort=Lang("被终止","Abort",1);
		CLog(tag+" "+abort,3,"From: "+msg+" ["+abort+"]");
		return true;
	}
};





/************** UI Step1: Read ACME service directory **************/
var choiceAcmeURLChangeAfter=function(){
	UserClickSyncID++;
	
	$(".step1Hide").hide();
	$(".step1Show").show();
	ShowState(".acmeReadDirState",false);
	
	if($(".in_acmeURL").val()) acmeReadDirClick();
};
window.acmeReadDirClick = function(callback) {
	var id =++ UserClickSyncID;
	var reqDir = function() {
		console.log("Z");
		ACME.Directory(ca_url, function() {
			console.log("A");
			callback();
		});
	};
	reqDir();
};

/************** UI Step2: Certificate Configuration **************/
var configStepShow = function() {
	$(".step2Hide").hide();
	$(".step2Show").show();
	ShowState(".configStepState",false);
	
	var el=$(".in_domains");
	var valS=localStorage[InputDomainsStoreKey];
	var val=DropConfigFile.domains&&DropConfigFile.domains.join(", ")||valS;
	if(!el.val()){
		el.val(val||"");
	}
	$(".choice_domains_store").prop("checked", !!valS);
	
	var el=$(".in_email");//填充上次填写的联系邮箱
	var valS=localStorage[InputEmailStoreKey];
	var val=DropConfigFile.email||valS;
	if(!el.val()){
		el.val(val||"");
	}
	$(".choice_email_store").prop("checked", !!valS);
	
	var setKey=function(k){
		if(DropConfigFile[k]){
			$("input[name=choice_"+k+"][value=manual]")[0].click();
			$(".in_"+k).val(DropConfigFile[k]);
		}
	};
	setKey("privateKey");setKey("accountKey");
	
	DropConfigFile={};//配置完成，丢弃拖拽进来的配置信息
};

window.configStepClick = function() {
	var id=++UserClickSyncID;
	var tag="Step-2",sEl=".configStepState";
	console.log('in configStepClick()');
	
	var privateKeyInfo;
	var parsePrivateKey = function() {
		X509.KeyParse(privateKey, function(info) {
			privateKeyInfo = info;
			parseAccountKey();
		},function(err) {
			ShowState(sEl, "The private key of the certificate is invalid: " + err,1);
		},1);
	};
	var accountKeyInfo;
	var parseAccountKey = function() {
		console.log('in parseAccountKey()')
		console.log('accountKey is ' + accountKey);
		X509.KeyParse(accountKey, function(info) {
			console.log("in parseAccountKey True");
			accountKeyInfo = info;
			parseKeyOK();
		}, function(err) {
			console.log("in parseAccountKey False");
			console.log("The private key of the ACME account is invalid: " + err);
			ShowState(sEl, "The private key of the ACME account is invalid: " + err, 1);
		},1);
	};

	parsePrivateKey();

	var parseKeyOK = function() {
		console.log('in parseKeyOK()');
		ACME.StepData.config = {
			domains: domains,
			privateKey: privateKeyInfo,
			accountKey: accountKeyInfo,
			email: email,
		};
		console.log('ACME.StepData.config:');
		console.log(ACME.StepData.config);
		acmeNewAccount();
	};
	//ACME
	var acmeNewAccount = function() {
		console.log('in acmeNewAccount()');
		ACME.StepAccount(function() {
			acmeNewOrder();
		}, function(err) {
			CLog(tag,1, ShowState(sEl,"Call the newAccount interface of the ACME service: "
				+ ACME.DirData.newAccount + ", An error occurred: " + err, 1));
		});
	};
	var acmeNewOrder=function() {
		console.log('in acmeNewOrder()');
		var msg0,onProgress=function(tips){
			if(id!=UserClickSyncID)return;
			msg0=CLog(tag,0, ShowState(sEl,PleaseWaitTips()+Lang("正在调用ACME服务的订单接口。","The order interface that is calling the ACME service.")+' '+tips+" URL:"+ACME.DirData.newOrder, 2));
		}; onProgress("");
		ACME.StepOrder(onProgress,function(){
			if(UserClickSyncKill(id,tag,msg0))return;
			acmeOK();
		},function(err){
			if(UserClickSyncKill(id,tag,msg0+" err: "+err))return;
			CLog(tag,1, ShowState(sEl,Lang("调用ACME服务的订单接口：","Call the order interface of the ACME service: ")
				+ACME.DirData.newOrder+Lang("，发生错误："+err,", An error occurred: "+err), 1));
		});
	};
	var acmeOK=function(){
		console.log('in acmeOK()');
		verifyStepShow();
		
		CLog(tag,0, ShowState(sEl,Lang(
			 "配置完成，"
			,"Configuration is complete, ")
			+NextStepTips(), 2), ACME.StepData);
	};
};

/************** UI Step3: Verify Domain Ownership **************/
var verifyStepShow=function(){
	$(".step3Hide").hide();
	$(".step3Show").show();
	$(".verifyStepBtn").show();
	$(".verifyRunStopBtn").hide();
	$(".finalizeOrderBtn").hide();
	ShowState(".verifyStepState",false);
    verifyBoxShow();	
};
//停止验证
window.verifyRunStopClick=function(){
	var id=++UserClickSyncID;
	$(".verifyStepBtn").show();
	$(".verifyRunStopBtn").hide();
	$(".finalizeOrderBtn").hide();
	ShowState(".verifyStepState",false);
	verifyRunStopFn&&verifyRunStopFn();
};
var verifyRunStopFn;
window.verifyStepClick=function(){
	var id=++UserClickSyncID;
	var tag="Step-3",sEl=".verifyStepState";
	
	$(".step3Hide").hide();
	$(".step3Show").show();
	$(".verifyStepBtn").hide();
	$(".verifyRunStopBtn").show();
	$(".finalizeOrderBtn").hide();
	ShowState(sEl,false);
	
	var auths = ACME.StepData.auths;
	var updateState = function(init,stopNow,isFail) {
		var isStop = stopNow || id != UserClickSyncID;
		var okCount = 0, errCount = 0, execCount = 0;
		for(var i0 =0; i0 < domains. length; i0++) {
			var domain = domains[i0], auth = auths[domain], challs = auth.challenges;
			var stateEl = $(".verifyItemState_" + i0);
			if (auth.authState==11) {
				ShowState(stateEl, ACME.ChallName(challs[auth.challIdx]) + " OK!", 2, "");
				okCount++;
				continue;
			}
			if (init) {
				var choiceEl = $("input[name=choice_authItem_" + i0 + "]");
				for (var i=0; i < choiceEl.length; i++) {
					var el = choiceEl[i];
					if (!el.checked) {
						$(el.parentNode).hide();
					} else {
						auth.challIdx=+$(el).attr("challidx");
					}
				}
				auth.authState = 0;
				auth.authTryCount = 0;
				auth.authError = "";
				auth.authTimer = 0;
			}
			var challName = ACME.ChallName(challs[auth.challIdx]);
			if (auth.authState==12) {
				ShowState(stateEl, challName + ", Verify failed: "
					+auth.authError,1,"");
				errCount++;
				continue;
			}
			execCount++;
			if(isStop){
				ShowState(stateEl,false);
				clearTimeout(auth.authTimer); auth.authTimer=0;
			}else if(auth.authState==2)
				ShowState(stateEl,Lang("等待重试中...","Waiting for retry...")
					+" "+auth.authTryCount+" "+auth.authError,3,"");
			else if(auth.authState==1)
				ShowState(stateEl,Lang("验证中...","Verify in progress..."),0,"");
			else ShowState(stateEl,Lang("等待验证...","Waiting for verify..."),0,"");
		}
		if(!isStop || stopNow){
			var goto2=Lang("请返回第二步重新开始操作！","Please go back to step 2 and start over! ");
			var msg=ShowState(sEl,(isFail?Lang("验证失败，","Verify failed, ")+goto2:
					isStop?Lang("已取消，","Canceled, ")+goto2:
					Lang("正在验证，请耐心等待... ","Verifying, please wait... "))
				+"<div>"
					+Lang("验证通过：","Verify pass: ")+okCount+", "
					+Lang("未通过：","Failed: ")+errCount+", "
					+Lang("验证中：","Verify in progress: ")+execCount
				+"</div>"
				, isStop?1:0);
			if(isStop){
				CLog(tag, 1, msg);
			}
		}
	}
	updateState(1);
	var run=function(){
		if(id!=UserClickSyncID)return;
		updateState();
		var authItem,hasRunning=0,okCount=0,errCount=0;
		for(var i0=0;i0<domains.length;i0++){
			var domain=domains[i0],auth=auths[domain];
			if(!authItem && !auth.authState) authItem=auth;
			if(auth.authState==1)hasRunning++;
			if(auth.authState==11)okCount++;
			if(auth.authState==12)errCount++;
		}
		if(okCount==domains.length)
			return verifyOK();
		if(okCount+errCount==domains.length)
			return verifyFail();
		if(!authItem || hasRunning)return;
		
		authItem.authState=1;
		authItem.authTryCount++;
		authItem.authError="";
		updateState();
		ACME.StepVerifyAuthItem(authItem, authItem.challIdx, function(isOk, retryTime, err){
			if(id!=UserClickSyncID)return;
			if(isOk){
				authItem.authState=11;
			}else{
				authItem.authState=2;
				authItem.authError=err;
				authItem.authTimer=setTimeout(function(){
					authItem.authState=0;
					authItem.authTimer=0;
					run();
				}, retryTime);
			}
			run();
		}, function(err){
			if(id!=UserClickSyncID)return;
			authItem.authState=12;
			authItem.authError=err;
			run();
		});
	};
	
	CLog(tag,0,"==========Verify Start==========");
	var verifyEnd=function(){
		$(".verifyRunStopBtn").hide();
		verifyRunStopFn=null;
		CLog(tag,0,"==========Verify End==========");
	};
	//中途停止控制
	verifyRunStopFn=function(){
		verifyEnd();
		updateState(0,1);
	};
	//验证完成，存在不通过的
	var verifyFail=function(){
		CLog(tag,1,"Verify Fail!");
		updateState(0,1,1);
		verifyEnd();
	};
	//全部验证成功
	var verifyOK=function(){
		CLog(tag,0,"Verify OK!");
		verifyEnd();
		
		finalizeOrderClick();
	};
	
	//调用完成订单接口，生成证书
	window.finalizeOrderClick=function(){
		$(".finalizeOrderBtn").hide();
		var msg0,onProgress=function(tips){
			if(id!=UserClickSyncID)return;
			msg0=CLog(tag,0, ShowState(sEl,PleaseWaitTips()
			+Lang("验证已通过，正在签发证书。","Verify passed, issuing certificate.")
			+' '+tips, 2));
		}; onProgress("");
		ACME.StepFinalizeOrder(onProgress,function(){
			if(UserClickSyncKill(id,tag,msg0))return;
			//显示下一步
			downloadStepShow();
			
			CLog(tag,0, ShowState(sEl,Lang(
				 "验证已通过，证书已签发，"
				,"Verification passed, The certificate has been issued, ")
				+NextStepTips(), 2), ACME.StepData);
		},function(err){
			if(UserClickSyncKill(id,tag,msg0+" err: "+err))return;
			$(".finalizeOrderBtn").show();
			CLog(tag,1, ShowState(sEl,Lang("签发证书发生错误，","Error issuing certificate, ")+TryAgainTips()
				+Lang("如果多次重试都无法签发证书，可能需要返回第二步重新开始操作。","If the certificate cannot be issued after multiple retries, you may need to return to step 2 to restart the operation.")
				+" Error: "+err, 1));
		});
	};
	
	run();
};

/************** UI Step4: Download and save the certificate PEM file **************/
var downloadStepShow=function(){
	$(".step4Hide").hide();
	$(".step4Show").show();
	ShowState(".downloadStepState",false);
	
	var config=ACME.StepData.config;
	var hasPEM=ACME.StepData.order.downloadPEM;
	var pemTxt=hasPEM||Lang("未发现证书，请到第二步重新操作！","No certificate found, please go to the step 2 to operate again!",true);
	
	console.log('PEM TXT');
	console.log(pemTxt);
	console.log('PEM TXT');

	// Import our cert to complete the Chrome Platform Keys Flow
	
	// Match the cert data of the 1st certificate
        var regex = /(-+BEGIN CERTIFICATE-+)(.*?)(-+END CERTIFICATE-+)/s
	const result = pemTxt.match(regex);
	var derTxt = result[2];
	console.log('derTxt');
	console.log(derTxt);
	var binary_cert = decodestr2ab(derTxt);
	console.log('binary_cert');
	console.log(typeof(binary_cert));
	console.log(binary_cert.length);
	console.log(binary_cert);
	var key_type;
	if (window.user_or_machine_key == 'machine') {
	    key_type = 'system';
	} else {
	    key_type = 'user';
	}
	chrome.enterprise.platformKeys.importCertificate(key_type,
	                                                 binary_cert,
	                                                 function () { console.log('Finished importing certificate.'); });
	$(".txt_downloadCert").val(pemTxt);
	$(".txt_downloadKey").val(config.privateKey.pem);
	
	downFileName=config.domains[0].replace(/^\*\./g,"").replace(/[^\w]/g,"_");
	downloadFileNameShow(downFileName);
	
	var logTxts=[];
	var SP=function(tag){
		logTxts.push("\n=========== "+tag+" ===========");
		return logTxts
	}
	var logSet=Object.assign({
		acmeURL:ACME.URL
		,accountURL:ACME.StepData.account.url
		,X509:{
			DefaultType2_RSA:X509.DefaultType2_RSA
			,DefaultType2_ECC:X509.DefaultType2_ECC
		}
		,Window:{
			DefaultDownloadFileNames:DefaultDownloadFileNames
		}
	},config);
	logSet.privateKey=config.privateKey.pem;
	logSet.accountKey=config.accountKey.pem;
	
	var logTitle='/********** '+Lang($(".clientNameCN").html(),$(".clientNameEN").html(),true)+' *********/';
	logTxts.push(logTitle);
	logTxts.push(Lang("在线网址：","Online website: ", true)+'https://xiangyuecn.github.io/ACME-HTML-Web-Browser-Client/ACME-HTML-Web-Browser-Client.html');
	logTxts.push("");
	logTxts.push('GitHub: https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client');
	logTxts.push('Gitee: https://gitee.com/xiangyuecn/ACME-HTML-Web-Browser-Client');
	logTxts.push("");
	logTxts.push(Lang("提示：你可以将本文件拖拽进客户端网页内，将自动填充本次证书申请的所有配置参数。","Tip: You can drag and drop this file into the client web page, and all configuration parameters of this certificate application will be filled automatically.",true));
	logTxts.push("");
	SP(Lang("证书申请时间","Certificate Application Time",true))
		.push(new Date().toLocaleString());
	SP(Lang("域名列表","Domain Name List",true))
		.push(config.domains.join(", "));
	SP(Lang("ACME服务地址","ACME Service URL",true))
		.push(ACME.URL);
	SP(Lang("CSR文本","CSR Text",true))
		.push(ACME.StepData.order.orderCSR);
	SP(Lang("证书PEM文本","Certificate PEM Text",true))
		.push(pemTxt);
	SP(Lang("证书私钥PEM文本","Certificate Private Key PEM Text",true))
		.push(config.privateKey.pem);
	SP(Lang("账户私钥PEM文本","Account Private Key PEM Text",true))
		.push(config.accountKey.pem);
	SP(Lang("账户URL","Account URL",true))
		.push(ACME.StepData.account.url);
	SP(Lang("完整配置信息","Complete Configuration Information",true))
		.push("<ACME-HTML-Web-Browser-Client>"+JSON.stringify(logSet)+"</ACME-HTML-Web-Browser-Client>");
	logTxts.push("");logTxts.push(logTitle);logTxts.push("");
	
	$(".txt_downloadLog").val(hasPEM?logTxts.join("\n"):pemTxt);
};
var initStep4=function(){//页面启动时初始化，绑定配置文件拖拽事件
	$("body").bind("dragover",function(e){
		e.preventDefault();
	}).bind("drop",function(e){
		e.preventDefault();
		
		var file=e.dataTransfer.files[0];
		if(!file)return;
		var reader = new FileReader();
		reader.onload = function(e){
			var txt=reader.result;
			var m=/ACME-HTML-Web-Browser-Client>(.+?)<\/ACME-HTML-Web-Browser-Client/.exec(txt);
			if(!m) return Toast(Lang("拖入的文件中未发现配置信息，请拖上次申请证书时保存的记录LOG文件！","No configuration information is found in the dragged file. Please drag the LOG file saved in the last certificate application!"),1);
			
			DropConfigFile=JSON.parse(m[1]);
			for(var k in DropConfigFile.X509)X509[k]=DropConfigFile.X509[k];
			for(var k in DropConfigFile.Window)window[k]=DropConfigFile.Window[k];
			
			CLog("DropConfigFile",0,"Reset Config",DropConfigFile);
			Toast(Lang("识别到拖入的记录LOG文件，已填充上次申请证书时使用的配置。","The LOG file of the dragged record is identified, and the configuration used in the last certificate application has been filled."),2);
			resetStep1();//重新初始化第1步
			downloadFileNameShow();
		}
		reader.readAsText(file);
	});
};
var downFileName="";
window.DefaultDownloadFileNames={ //允许设置默认的文件名，下载时自动使用此文件名
	Cert:"" /*domain.crt*/, Key:"" /*domain.key*/, Log:"" /*domain.log*/
};
window.downloadBtnClick=function(type){
	var val=$(".txt_download"+type).val();
	var fileName=downFileName;
	if(type=="Cert") fileName+=".pem";
	if(type=="Key") fileName+=".key";
	if(type=="Log") fileName+=".log";
	fileName=DefaultDownloadFileNames[type]||fileName;
	
	var url=URL.createObjectURL(new Blob([val], {"type":"text/plain"}));
	var downA=document.createElement("A");
	downA.href=url;
	downA.download=fileName;
	downA.click();
};
window.downloadFileNameShow=function(name){//显示下载文件名称，优先使用手动设置的默认名称
	name=name||"your_domain";
	var name2=(DefaultDownloadFileNames.Cert||"").replace(/\.[^\.]+$/g,"");
	$(".downloadFileName").html(name2||name);
	$(".downloadKeyFileName").html(DefaultDownloadFileNames.Key||name+".key");
	$(".downloadCertFileName").html(DefaultDownloadFileNames.Cert||name+".pem");
};













//Test_打头的方法仅供测试用：完成第二步后允许进行UI调试，手动调用Test_AllStepData_Save()，刷新页面可恢复界面
window.Test_AllStepData_Save=function(){
	if(!ACME.StepData.order) throw new Error(Lang("未完成第二步操作","The step 2 is not completed",true));
	
	var config=ACME.StepData.config;
	delete ACME.PrevNonce;
	config.privateKey=config.privateKey.pem;
	config.accountKey=config.accountKey.pem;
	
	localStorage[Test_AllStepData_StoreKey]=JSON.stringify(ACME);
	ACME=null;
	console.warn(Lang("仅供测试：已保存测试数据，需刷新页面","For testing only: the test data has been saved, and the page needs to be refreshed",true));
};
var Test_AllStepData_StoreKey="ACME_HTML_Test_AllStepData";
var initTest_Restore=function(){
	if(localStorage[Test_AllStepData_StoreKey]){
		console.warn(Lang("仅供测试：已保存测试数据，调用Test_Restore_StepXXX()进行恢复步骤界面","For testing only: test data has been saved, call Test_Restore_StepXXX() to restore the step interface",true));
	}
}
var Test_AllStepData_Restore=function(next){
	var data=JSON.parse(localStorage[Test_AllStepData_StoreKey]||"{}");
	if(!data.StepData) throw new Error(Lang("未保存数据","No data saved",true));
	for(var k in data) ACME[k]=data[k];
	
	var config=ACME.StepData.config;
	X509.KeyParse(config.privateKey, function(info){
		config.privateKey=info;
		X509.KeyParse(config.accountKey, function(info){
			config.accountKey=info;
			console.log("ACME.StepData", ACME.StepData);
			setTimeout(function(){next()});
		});
	});
};
window.Test_Restore_StepAuth=function(){
	Test_AllStepData_Restore(function(){
		console.warn(Lang("仅供测试：已手动恢复步骤三界面","For testing only: Step 3 interface has been manually restored",true));
		verifyStepShow();
	});
};
window.Test_Restore_StepDownload=function(){
	Test_AllStepData_Restore(function(){
		console.warn(Lang("仅供测试：已手动恢复步骤四界面","For testing only: Step 4 interface has been manually restored",true));
		downloadStepShow();
	});
};



})();

var accountKey;
function AccountKeyGenerate(callback) {
	var type = "ECC";
	var type2 = X509.DefaultType2_ECC;
	X509.AccountKeyGenerate(type, type2, function(pem) {
		accountKey = pem;
		callback();
	});
};


var privateKey;
function hwKeyGenerate(callback) {
  X509.KeyGenerate(window.algorithm, window.user_or_machine_key, function(pem) {
	  privateKey = pem;
	  callback();
  },
  function() { console.log('failed in false'); });
}

window.addEventListener("load", (event) => {
  hwKeyGenerate(function() {
    AccountKeyGenerate(function() {  
      window.acmeReadDirClick(function() {
        window.configStepClick();
      });
    });
  });
});
