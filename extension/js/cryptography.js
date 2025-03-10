//==================================================================
//================= RSA/ECC/X.509/ASN.1 functions ==================
//==================================================================
//LICENSE: GPL-3.0, https://github.com/xiangyuecn/ACME-HTML-Web-Browser-Client
(function(){
"use strict";

function spkiToPEM(spki) {
  var body = window.btoa(String.fromCharCode(...new Uint8Array(spki)));
  body = body.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

var publicKey;
var keyPair;
var myToken;

window.X509={
	DefaultType2_RSA:"2048"
	,DefaultType2_ECC:"P-256"
	,SupportECCType2:{
		"P-256":"prime256v1", "P-384":"secp384r1", "P-521":"secp521r1"
	}
	,SupportECCType2Names:function(){ var str=[]; for(var k in X509.SupportECCType2)str.push(X509.SupportECCType2[k]); return str; }
	,AccountKeyGenerate:function(type, type2, True, False) {
		var algorithm=0;
		if(type=="RSA") {
			algorithm = { publicExponent: new Uint8Array([1, 0, 1]) //E: AQAB
				,name:"RSASSA-PKCS1-v1_5", modulusLength:+type2, hash:"SHA-256" };
		} else if(type=="ECC") {
			algorithm = { name:"ECDSA", namedCurve:type2 };
		} else {
			False("Not support " + type);
			return;
		};
		crypto.subtle.generateKey(algorithm, true, ["sign","verify"])
			.then(function(key) {
				crypto.subtle.exportKey("jwk", key.privateKey).then(function(jwk) {
					True(X509.KeyExport(jwk));
				}).catch(function(e) {
					False('This browser does not support exporting ' + algorithm.name + '+PKCS#8 format keys: '+e.message);
				});
			}).catch(function(e){
				False('This browser does not support generating '+algorithm.name+': '+e.message);
			});
	},
	,KeyGenerate:function(type, type2, True, False) {
		var algorithm = 0;
		if (type == "RSA") {
			algorithm={ publicExponent: new Uint8Array([1, 0, 1]) //E: AQAB
				,name:"RSASSA-PKCS1-v1_5", modulusLength:+type2, hash:"SHA-256" };
		}else if(type=="ECC"){
			algorithm={ name:"ECDSA", namedCurve:type2 };
		}else{
			False("Not support "+type);
			return;
		};
		chrome.enterprise.platformKeys.getTokens().then(function(tokens) {
		  for (var i = 0; i < tokens.length; i++) {
                    if (tokens[i].id == "system") {
		      myToken = tokens[i];
		    }
	          }
	          myToken.subtleCrypto.generateKey(algorithm, false, ['sign', 'verify'])
			.then(function(key){
				keyPair = key;
				myToken.subtleCrypto.exportKey('spki', keyPair.publicKey).then(function(spki) {
					publicKey = spkiToPEM(spki);
					console.log(publicKey);
					True(publicKey);
				}).catch(function(e){
					False('This browser does not support exporting '+algorithm.name+'+PKCS#8 format keys: ' + e.message);
				});
			}).catch(function(e){
				False('This browser does not support generating ' + algorithm.name+': ' + e.message);
			});
	});
	}
	,KeyParse:function(pem, True, False, mustPrivate){
		var rtv={};
		var Err = function(msg) {
			rtv.error = msg;
			False(msg, rtv);
		        };
		if (!/BEGIN\s*(RSA|EC)?\s*(PUBLIC|PRIVATE)\s*KEY/.test(pem))
			return Err('Not an RSA or ECC key');
		rtv.type=RegExp.$1=="EC"?"ECC":RegExp.$1;
		var isPKCS1=!!RegExp.$1;
		var isPub=RegExp.$2=="PUBLIC";
		//if(isPub && mustPrivate)
		//	return Err('Is not a private key');
		
		try{
			var paramAsn1=null;
			var asn1=ASN1.ParsePEM(pem);
			rtv.asn1=asn1;
			
			if(isPKCS1){
				if(rtv.type=="RSA") {
					paramAsn1=asn1;
				}else if(rtv.type=="ECC") {
					if(isPub)
						return Err('ECC PKCS#1 format public key is not supported');
					var oid2=asn1.sub[2].sub[0].oid;
					rtv.type2=ASN1.OID[oid2]||"";
					paramAsn1=asn1;
				}
			}else{
				var idx=isPub?0:1;
				var oid=asn1.sub[idx].sub[0].oid;
				var oid2=asn1.sub[idx].sub[1].oid;
				rtv.type=ASN1.OID[oid]||"";
				rtv.type2=ASN1.OID[oid2]||"";
				
				if(rtv.type=="ECC"&&isPub)
					paramAsn1=asn1;
				else
					paramAsn1=new ASN1().parse(asn1.sub[idx+1].bytes);
			}
			rtv.paramAsn1=paramAsn1;
		}catch(e){
			return Err('Key resolution failed: ' + e.message);
		}
		if(rtv.type=="RSA"){
			var idx=isPub?0:1;
			rtv.param={
				n:paramAsn1.sub[idx].bytes //Modulus
				,e:paramAsn1.sub[idx+1].bytes //Exponent
				,d:isPub?null:paramAsn1.sub[idx+2].bytes //D
			};
			var keys="p,q,dp,dq,qi".split(",");
			for(var i=0;i<5;i++)
				rtv.param[keys[i]]=isPub?null:paramAsn1.sub[idx+3+i].bytes;
			rtv.type2=rtv.param.n.length*8+"";
		}else if(rtv.type=="ECC"){
			if(!X509.SupportECCType2[rtv.type2]){
				return Err('ECC key only supported for '+ X509.SupportECCType2Names().join(",") + ' curve');
			}
			if(isPub){
				var b2=paramAsn1.sub[1].bytes;
			}else{
				var idx=isPKCS1?3:2;
				var b2=paramAsn1.sub[idx].sub[0].bytes;
			}
			if(b2[0]!=0x04)
				return Err("ECC !0x04: "+b2[0]);
			var bits=(b2.length-1)/2;
			rtv.param={
				x:b2.slice(1,1+bits)
				,y:b2.slice(1+bits)
				,d:isPub?null:paramAsn1.sub[1].bytes //D
			};
		}else{
			return Err('Unsupported key type: ' + oid);
		}
		rtv.isPKCS1=isPKCS1;
		rtv.hasPrivate=!isPub;
		rtv.pem=pem;
		
		var algorithm,jwk;
		if(rtv.type=="RSA"){
			algorithm={ publicExponent: new Uint8Array(rtv.param.n.buffer)
			,name:"RSASSA-PKCS1-v1_5", modulusLength:+rtv.type2, hash:"SHA-256" };
			jwk={ kty:"RSA", alg: "RS256" };
		}else if(rtv.type=="ECC"){
			algorithm={ name:"ECDSA", namedCurve:rtv.type2 };
			jwk={ kty:"EC", crv:rtv.type2 };
		}
		jwk=Object.assign(jwk,{ ext:true, key_ops:[isPub?"verify":"sign"] });
		for(var k in rtv.param)
			rtv.param[k]&&( jwk[k]=Bytes2UrlB64(rtv.param[k]) );
		
		crypto.subtle.importKey(
			"jwk",jwk,algorithm,true,[isPub?"verify":"sign"]
		).then(function(key){
			rtv.key=key;
			True(rtv);
		}).catch(function(e){
			Err(Lang('密钥转成CryptoKey失败：','Failed to convert key to CryptoKey: ')+e.message);
		});
	}
	
	,PublicKeyJwk:function(info){ // https://www.rfc-editor.org/rfc/rfc7638
		console.log('info');
		console.log(info);
		var p=info.param;
		if(info.type=="RSA"){
			return { e:Bytes2UrlB64(p.e), kty:"RSA", n:Bytes2UrlB64(p.n) };
		}else if(info.type=="ECC"){
			return { crv:info.type2, kty:"EC", x:Bytes2UrlB64(p.x),y:Bytes2UrlB64(p.y) };
		}else{
			throw new Error("Jwk: "+info.type);
		}
	}
	//解析出来的密钥或jwk对象转成PKCS#8格式 publicOnly：提供私钥时仅导出公钥 returnType：1 bytes，2 asn1，other pem
	,KeyExport:function(info, publicOnly, returnType){
		var tag="KeyExport: ", S=ASN1.S,V=ASN1.V; //ASN1快捷创建方式
		var param=info.param,type=param&&info.type,type2=info.type2;//解析出来的格式
		if(!param){//jwk
			if(info.kty){
				type=info.kty=="EC"?"ECC":info.kty;
				if(type=="ECC")type2=info.crv;
			}else throw new Error(tag+"bad key");
		}
		var keys=(type=="ECC"?"x,y,d":"n,e,d,p,q,dp,dq,qi").split(",");
		if(!param){//jwk参数需转成二进制
			param={};
			for(var i=0;i<keys.length;i++){
				var k=keys[i],b64=info[k];
				if(b64)param[k]=UrlB642Bytes(b64);
			}
		}
		var useD=!publicOnly&&param.d;//导出私钥
		
		var bytes;//封装参数
		if(type=="RSA"){
			var asn1=S(0x30, V(0x02, param.n), V(0x02, param.e));
			if(useD){//公钥只需n、e参数，私钥要全部
				asn1.sub.splice(0,0,V(0x02, [0]));//开头插入版本号
				for(var i=2;i<keys.length;i++){
					asn1.push(V(0x02, param[keys[i]]));
				}
			}
			bytes=asn1.toBytes();
		}else if(type=="ECC"){ //公钥x、y参数，私钥外面再套一层d
			var pubB=new Uint8Array(1+param.x.length*2); pubB[0]=0x04;
			pubB.set(param.x, 1);
			pubB.set(param.y, 1+param.x.length);
			if(useD){
				bytes=S(0x30, V(0x02,[1]), V(0x04, param.d)
					, S(0xA1, V(0x03, pubB)) ).toBytes();
			}else bytes=pubB;
		}else{ throw new Error(tag+type); }
		
		var typeASN1=S(0x30 //封装类型
			,V(0x06, ASN1.OID2Bytes(ASN1.OID[type]))
			,type=="RSA"?V(0x05,[])
					:V(0x06, ASN1.OID2Bytes(ASN1.OID[type2]))
		);
		
		if(useD){//封装私钥
			var keyA=S(0x30, V(0x02, [0]), typeASN1, V(0x04, bytes));
		}else{ //封装公钥
			var keyA=S(0x30 ,typeASN1, V(0x03, bytes));
		};
		if(returnType==2) return keyA;
		bytes=keyA.toBytes();
		if(returnType==1) return bytes;
		var str=Bytes2Base64(bytes).replace(/(.{64})/g,"$1\n").trim();
		var sp=useD?"PRIVATE":"PUBLIC";
		return '-----BEGIN '+sp+' KEY-----\n'+str+'\n-----END '+sp+' KEY-----';
	}
	
	
	,CreateCSR:function(keyInfo, commonName, domains, True, False) {
		var S = ASN1.S,V=ASN1.V;
		console.log('keyInfo');
		console.log(keyInfo);
		try {
			var pubA = X509.KeyExport(keyInfo, true, 2);
		} catch(e) { return False(e.message) }
		var altNameA = S(0x30);
		for(var i=0; i<domains.length; i++)
			altNameA.push(V(0x82, Str2Bytes(domains[i])));
		var bodyA = S(0x30
			,V(0x02, [0])
			,S(0x30, S(0x31 ,S(0x30 
				,V(0x06, ASN1.OID2Bytes("2.5.4.3"))
				,V(0x0C, Str2Bytes(commonName))
			)))
			,pubA 
			,S(0xA0, S(0x30
				,V(0x06, ASN1.OID2Bytes("1.2.840.113549.1.9.14"))
				,S(0x31, S(0x30, S(0x30
					,V(0x06, ASN1.OID2Bytes("2.5.29.17"))
					,V(0x04, altNameA.toBytes())
				)))
			))
		);
		var bodyBytes = bodyA.toBytes();
		var algorithm = {name: "ECDSA", hash: "SHA-256"};
		if(keyInfo.type == "RSA") {
			algorithm={ name: "RSASSA-PKCS1-v1_5"}
		}
		console.log('CSR algo:');
		console.log(algorithm);
		myToken.subtleCrypto.sign(algorithm,
                                        keyPair.privateKey,
                                        bodyBytes).then(function(arr) {
			var signBytes=new Uint8Array(arr);
			if (keyInfo.type=="ECC") {
				var s1 = signBytes.subarray(0,keyInfo.param.x.length);
				var s2 = signBytes.subarray(keyInfo.param.x.length);
				signBytes = S(0x30, V(0x02,s1), V(0x02,s2)).toBytes();
			}
			var csrA = S(0x30, bodyA
				,S(0x30
					,V(0x06, ASN1.OID2Bytes(ASN1.OID["SHA256_"+keyInfo.type]))
					,keyInfo.type == "RSA"?V(0x05,[]):null
				)
				,V(0x03, signBytes)
			);
			var bytes = csrA.toBytes();
			var str = Bytes2Base64(bytes).replace(/(.{64})/g,"$1\n").trim();
			var final_csr = '-----BEGIN CERTIFICATE REQUEST-----\n'+str+'\n-----END CERTIFICATE REQUEST-----';
			console.log('Final CSR');
			console.log(final_csr);
                        True(final_csr);
		})/*.catch(function(e){
			False("CSR sign:"+e.message);
		}); */
        }
};



//简单实现ASN.1解析和封包
window.ASN1=function(tag, bytes){
	this.sub=[];
	if(tag)this.setTag(tag);
	if(bytes)this.setBytes(bytes);
};

ASN1.S = function(tag) {
	var v = new ASN1(tag);
	for(var i=1, a = arguments; i < a.length; i++){a[i]&&v.push(a[i])}
	return v;
};

ASN1.V = function(tag, bytes){
	return new ASN1(tag, bytes)
};

ASN1.ParsePEM=function(pem){
	return new ASN1().parsePEM(pem);
};

ASN1.TagNames={
	'01':'BOOLEAN','02':'INTEGER','03':'BIT_STRING'
	,'04':'OCTET_STRING','05':'NULL','06':'OID'
	,'0C':'UTF8String','13':'Printable_String'
	,'17':'UTCTime','18':'GeneralizedTime','30':'SEQUENCE','31':'SET'
};
ASN1.OID={
	 "1.2.840.113549.1.1.1":"RSA"
	,"1.2.840.113549.1.1.11":"SHA256_RSA"
	,"1.2.840.10045.2.1":"ECC"
	,"1.2.840.10045.4.3.2":"SHA256_ECC"
	,"1.2.840.10045.3.1.7":"P-256" //secp256r1 | prime256v1
	,"1.3.132.0.34":"P-384" //secp384r1
	,"1.3.132.0.35":"P-521" //secp521r1
};	for(var k in ASN1.OID)ASN1.OID[ASN1.OID[k]]=k;
ASN1.OID2Bytes=function(oid){
	var arr = oid.split('.'), byts = [];
	var v0=+arr[0],v1=+arr[1];
	if (!/^[\d\.]+$/.test(oid)|| arr.length < 3 || v0 > 2 || v0 * 40 + v1 > 0xff)
		throw new Error("bad oid: "+oid);
	byts.push(v0 * 40 + v1);
	for (var i = 2, len = arr.length; i < len; i++) {
		var num = +arr[i], bits = [];
		while (num >= 0x80) { bits.push(num % 0x80); num /= 0x80; }
		bits.push(num); bits.reverse();
		for (var j = 0, jl = bits.length - 1; j <= jl; j++) {
			if (j != jl) {
				byts.push(0x80 + bits[j]);
			} else {
				byts.push(bits[j]);
			}
		}
	}
	return new Uint8Array(byts);
};
ASN1.OID2Text=function(bytes){
	var str = "", b0 = bytes[0];
	var m = b0 < 80 ? b0 < 40 ? 0 : 1 : 2;
	str+=m+"."+(b0 - m * 40);
	for (var i = 1, len = bytes.length; i < len; ) {
		var num = 0;
		for (; i < len; ) {
			var bit = bytes[i++]; num *= 0x80;
			if (bit >= 0x80) num += bit - 0x80;
			else { num += bit; break; }
		}
		str+="."+num;
	}
	return str;
};
ASN1.ParseSize=function(pos, bytes){ //简单解析长度数值
	var bitCount=bytes[pos[0]++],size=0;
	if(bitCount < 0x80) size=bitCount;
	else if(bitCount == 0x80) size=-404; //不定长，需搜索两个0结尾，直接拒绝支持
	else for(var i=0,len=bitCount&0x7F;i<len;i++)
		size=size*256+bytes[pos[0]++];
	if(size<0 || size>bytes.length-pos[0])throw new Error("ASN.1 Bad size "+size);
	return size;
};
ASN1.ParseBlock=function(pos, bytes, sub){ //简单解析一块子内容
	sub=sub||[];
	while(pos[0]<bytes.length){
		var idx0=pos[0],item=new ASN1();
		var tag=bytes[pos[0]++],size=ASN1.ParseSize(pos, bytes);
		if((tag&0x20) != 0){//结构化容器，嵌套调用
			item.parse(bytes.slice(idx0, pos[0]+size));
		}else{//普通内容
			var chunk=bytes.slice(pos[0], pos[0]+size);
			if(tag==0x02 || tag==0x03){//去掉开头补的0，正整数
				if(chunk.length>1 && chunk[0]==0){
					chunk=chunk.slice(1);
				}
			}
			item.setTag(tag);
			item.setBytes(chunk);
		}
		sub.push(item);
		pos[0]+=size;
	}
	return sub;
};
ASN1.PEM2Bytes=function(pem){
	pem=pem.replace(/[\s\r\n]/g,"");
	var m=/^-+BEGIN\w*-+([^-]+)-+END\w+-+$/i.exec(pem);
	try{
		return Base642Bytes(m[1]);
	}catch(e){
		throw new Error(Lang('不是pem格式。','Not a pem format.'));
	}
};
ASN1.prototype={
	setTag:function(tag){
		var txt=(tag<16?"0":"")+tag.toString(16).toUpperCase();
		this.tag=tag;
		this.tagTxt=txt;
		this.tagName=ASN1.TagNames[txt]||"0x"+txt;
	}
	,setBytes:function(bytes){
		if(bytes.length==null||(bytes.slice==null && bytes.subarray==null))
			throw new Error("Not Array");
		if(this.tag==0x06) this.oid=ASN1.OID2Text(bytes);
		if(this.tag==0x0C||this.tag==0x13) this.string=Bytes2Str(bytes);
		this.bytes=bytes;
	}
	,push:function(asn1){
		if(!asn1.parsePEM) throw new Error("Not ASN1");
		this.sub.push(asn1);
		return this;
	}
	,parsePEM:function(pem){
		return this.parse(ASN1.PEM2Bytes(pem));
	}
	,parse:function(bytes){
		var pos=[0];
		//最外层必须是个结构化容器，第6位为1，为0为基础类型 https://www.jianshu.com/p/ce7ab5f3f33a
		if((bytes[0]&0x20) == 0) throw new Error("ASN.1 parse: Not SEQ");
		this.setTag(bytes[pos[0]++]);
		var size=ASN1.ParseSize(pos, bytes);
		bytes=bytes.slice(pos[0], pos[0]+size);
		this.setBytes(bytes);
		//解析子内容
		ASN1.ParseBlock([0], bytes, this.sub);
		return this;
	}
	,toBytes:function(innerOlny){
		var chunks=[],len=0;
		if(this.sub.length){//容器类型，递归调用
			for(var i=0;i<this.sub.length;i++){
				var arr=this.sub[i].toBytes();
				chunks.push(arr); len+=arr.length;
			}
		}else if(this.bytes&&this.bytes.length){//简单类型
			if(this.tag==0x02 && this.bytes[0] >= 0x80 || this.tag==0x03){
				chunks.push([0]);len++;  //0x02负数 0x03需要开头补0
			}
			chunks.push(this.bytes); len+=this.bytes.length;
		}
		if(!innerOlny){//添加标签和长度
			var arr=[], num=len;
			if(num<0x80) arr.push(num);
			else {
				while(num>0xff){ arr.push(num&0xff); num=num>>8; }
				arr.push(num&0xff); arr.push(0x80+arr.length);
			}
			arr.push(this.tag); arr.reverse();
			chunks.splice(0,0,arr); len+=arr.length;
		}
		var bytes=new Uint8Array(len),n=0;
		for(var i=0;i<chunks.length;i++){
			var arr=chunks[i];
			bytes.set(arr, n); n+=arr.length;
		}
		return bytes;
	}
};

})();
