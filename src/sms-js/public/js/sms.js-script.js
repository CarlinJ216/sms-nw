$(document).ready(function() {
    $("#masterPage").on("orientationchange", function(e, o) {
        sizeVideo();
    });

    $(window).resize(function() {
        sizeVideo();
    });

    $("video").on( "loadedmetadata", sizeVideo);
});


/*
$("video").on( "loadedmetadata", function() {
    console.log("made it!");
    sizeVideo(this);
});

function init() {
    video.addEventListener('loadedmetadata', sizeVideo(this), false);
};
*/
function sizeVideo() {
    console.log("made it!");
    var rawWidth = $("video").prop('videoWidth');
    var rawHeight = $("video").prop('videoHeight');
    var divWidth = parseInt($('.mediaContent').css('width').replace("px",""));
    console.log('width: '+rawWidth);
    console.log('height: '+rawHeight);
    console.log('divWidth: '+divWidth);
    if(rawWidth > divWidth){
        rawHeight = rawHeight/(rawWidth/divWidth);
        rawWidth = divWidth;       
    }
    $("video").css('width',rawWidth);
    $("video").css('height',rawHeight);
};

/*
function reqListener(id, html) {
    document.getElementById(id).innerHTML = html;
};

function sendReq(url,id) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function() {
        reqListener(id,this.responseText);
    };
    
    oReq.open("get", url, false);
    oReq.overrideMimeType("text/html; charset=x-user-defined");
    oReq.send();
};
*/
