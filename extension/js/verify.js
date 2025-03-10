var ab2base64str = function(buf) {
    var binary = '';
    var bytes = new Uint8Array(buf);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

var decodestr2ab = function(str) {
    var binary_string =  window.atob(str);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

function base64ToUrlSafe(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function spkiToPEM(spki) {
  var body = window.btoa(String.fromCharCode(...new Uint8Array(spki)));
  body = body.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

async function getVAChallenge() {
  var challenge;
  var challenge_response;
  var apiKey = 'AIzaSyAS5-tV_UcjJiM9dkz7e_FsG1qWMdHGr2k';
  var challengeUrlString = 'https://verifiedaccess.googleapis.com/v2/challenge:generate?key=' + apiKey;
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open('POST', challengeUrlString, false);
  xmlhttp.send(null);
  challenge = JSON.parse(xmlhttp.responseText).challenge;
  console.log('challenge: ' + challenge);
  var options = {
      'challenge': decodestr2ab(challenge),
      'registerKey': {
        'algorithm': 'ECDSA',
      },
      'scope': 'MACHINE',
  };
  var challenge_response = await chrome.enterprise.platformKeys.challengeKey(options);
  return challenge_response;
}

var verifyBoxShow=function(){
	"use strict";
	var boxEl=$(".verifyBox").html("");
	var auths=JSON.parse(JSON.stringify(ACME.StepData.auths));//避免改动原始数据
	var domains=ACME.StepData.config.domains;
	for(var i0=0;i0<domains.length;i0++){
		var domain=domains[i0],auth=auths[domain]
		
		var challs=auth.challenges;
		for(var i=0;i<challs.length;i++){//排序，dns排前面
			var o=challs[i];
			o.challIdx=i;
			o.name=ACME.ChallName(o);
			o._sort=ACME.ChallSort(o);
		}
		challs.sort(function(a,b){return a._sort.localeCompare(b._sort)});
		var choiceHtml="";
		for(var i=0;i<challs.length;i++){
			var chall=challs[i];
			choiceHtml+=`
<label>
	<input type="radio" name="choice_authItem_${i0}"
		class="choice_authChall choice_authChall_${i0} choice_authChall_${i0}_${i}"
		value="${i0}_${i}" challidx="${chall.challIdx}">${chall.name}
</label>
			`;
		}
		
		boxEl.append(`
<div class="itemBox">
	<div class="pd FlexBox" style="line-height:26px">
		<div><i class="must">*</i></div>
		<div style="width:180px;padding-right:5px;text-align:right;background:#03baed;color:#fff;border-radius: 4px;">${domain}</div>
		<div class="FlexItem" style="padding-left:10px;">${choiceHtml}</div>
	</div>
	<div class="verifyItemBox_${i0}"></div>
	<div class="verifyItemState_${i0}"></div>
</div>
		`);
	};
	LangReview(boxEl);
	
	$(".choice_authChall").bind("click",function(e){
		var el=e.target,vals=el.value.split("_"),i0=+vals[0],i2=+vals[1];
		var domain=domains[i0],auth=auths[domain],chall=auth.challenges[i2];
		var html=['<div class="pd" style="padding-left:10px;font-size:13px;color:#aaa">'];
		var nameCss='width:195px;text-align:right;padding-right:10px';
		console.log('challenge type:');
		console.log(chall.type);
		html.push('For non-predefined authentication types, please use <i class="i">Key Authorizations (Token+.+Thumbprint)</i> to handle it yourself. <i class="i">Digest</i> is the SHA-256 Base64 value of Key Authorizations.</div>');
		html.push(`<div class="pd FlexBox">
			<div style="${nameCss}">Key Authorizations:</div>
			<div class="FlexItem">
				<input style="width:100%" readonly value="${chall.authTxt}" />
			</div>
		</div>
		<div class="pd FlexBox">
			<div style="${nameCss}">Digest(SHA-256 Base64):</div>
			<div class="FlexItem">
				<input style="width:100%" readonly value="${chall.authTxtSHA256Base64}" />
			</div>
		</div>`);
		$(".verifyItemBox_"+i0).html(html.join('\n'));
		getVAChallenge().then(challenge_response => {
		  window.challenge_response = base64ToUrlSafe(
			  ab2base64str(
				  CBOR.encode(
					  {fmt: "chromeos",
					   attStmt: {
			     			"challenge_response": ab2base64str(challenge_response)
					   }}
				  )
			  )
		  )
		  console.log('challenge_response:');
		  console.log(window.challenge_response);
		});
	});
	for(var i0=0;i0<domains.length;i0++){
		var el=$(".choice_authChall_"+i0+"_0");
		el[0]&&el[0].click();
	}
};
