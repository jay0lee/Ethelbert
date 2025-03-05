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
		if(chall.type=="dns-01"){
			html.push('Please go to the DNS resolution management of your domain name and add a <i class="i">TXT record</i> for the following subdomain name (a subdomain name can have multiple TXT records at the same time, and the old records can be modified or deleted).</div>');
			html.push(`<div class="pd FlexBox">
				<div style="${nameCss}">${'Sub Domain'}:</div>
				<div class="FlexItem">
					<input style="width:100%" readonly value="_acme-challenge.${auth.identifier.value}" />
				</div>
			</div>
			<div class="pd FlexBox">
				<div style="${nameCss}">${Lang('TXT记录','TXT Record')}:</div>
				<div class="FlexItem">
					<input style="width:100%" readonly value="${chall.authTxtSHA256}" />
				</div>
			</div>`);
		}else if(chall.type=="http-01"){
			html.push(Lang('请在你的网站根目录中创建<i class="i">/.well-known/acme-challenge/</i>目录，目录内创建<i class="i">'+FormatText(chall.token)+'</i>文件，文件内保存下面的文件内容，保存好后<a href="http://'+auth.identifier.value+'/.well-known/acme-challenge/'+FormatText(chall.token)+'" target="_blank">请点此打开此文件URL</a>测试能否正常访问；注意：这个文件URL必须是80端口，并且公网可以访问，否则ACME无法访问到此地址将会验证失败。Windows操作提示：Windows中用<i class="i">.well-known.</i>作为文件夹名称就能创建<i class="i">.well-known</i>文件夹；IIS可能需在此文件夹下的MIME类型中给 <i class="i">.</i> （扩展名就是一个字"."）添加 <i class="i">text/plain</i> 才能正常访问。','Please create the <i class="i">/.well-known/acme-challenge/</i> directory in the root directory of your website, create the <i class="i">'+FormatText(chall.token)+'</i> file in the directory, and save the following file content in the file; After saving, <a href="http://'+auth.identifier.value+'/.well-known/acme-challenge/'+FormatText(chall.token)+'" target="_blank">please click here to open the URL</a> of this file to test whether Normal access; note: the URL of this file must be 80 The port and the public network can be accessed, otherwise ACME cannot access this address and the verification will fail. Windows operation tips: In Windows, you can create a <i class="i">.well-known</i> folder by using <i class="i">.well-known.</i> as the folder name; IIS may need to give <i class="i">.</i> in the MIME type under this folder (the extension is a word ".") Add <i class="i">text/plain</i> for normal access.')+'</div>');
			html.push(`<div class="pd FlexBox">
				<div style="${nameCss}">${Lang('文件URL','File URL')}:</div>
				<div class="FlexItem">
					<input style="width:100%" readonly value="http://${auth.identifier.value}/.well-known/acme-challenge/${FormatText(chall.token)}" />
				</div>
			</div>
			<div class="pd FlexBox">
				<div style="${nameCss}">${Lang('文件内容','File Content')}:</div>
				<div class="FlexItem">
					<input style="width:100%" readonly value="${chall.authTxt}" />
				</div>
			</div>`);
		} else {
			html.push(Lang('非预定义验证类型，请使用<i class="i">Key Authorizations (Token+.+指纹)</i>自行处理，<i class="i">Digest</i>为Key Authorizations的SHA-256 Base64值。','For non-predefined authentication types, please use <i class="i">Key Authorizations (Token+.+Thumbprint)</i> to handle it yourself. <i class="i">Digest</i> is the SHA-256 Base64 value of Key Authorizations.')+'</div>');
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
		}
		$(".verifyItemBox_"+i0).html(html.join('\n'));
	});
	for(var i0=0;i0<domains.length;i0++){
		var el=$(".choice_authChall_"+i0+"_0");
		el[0]&&el[0].click(); //默认选中每个域名的第一个
	}
};
