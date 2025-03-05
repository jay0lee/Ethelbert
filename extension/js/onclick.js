document.addEventListener('DOMContentLoaded', function() {
    var link2 = document.getElementById('configStepClick');
    link2.addEventListener('click', function() {
	configStepClick();
    });
    var link3 = document.getElementById('verifyStepClick');
    link3.addEventListener('click', function() {
	verifyStepClick();
    });
    var link4 = document.getElementById('verifyRunStopClick');
    link4.addEventListener('click', function() {
        verifyRunStopClick();
    });
    var link5 = document.getElementById('finalizeOrderClick');
    link5.addEventListener('click', function() {
        finalizeOrderClick();
    });
    var link6 = document.getElementById('downloadBtnClickCert');
    link6.addEventListener('click', function() {
        downloadBtnClick('Cert');
    });
    var link7 = document.getElementById('downloadBtnClickKey');
    link7.addEventListener('click', function() {
        downloadBtnClick('Key');
    });
    var link8 = document.getElementById('downloadBtnClickLog');
    link8.addEventListener('click', function() {
        downloadBtnClick('Log');
    });
    var link1 = document.getElementById('link1');
    link1.addEventListener('click', function() {
        acmeReadDirClick();
    });
});
