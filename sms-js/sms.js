var
http = require('http'),
path = require('path'),
fs = require('fs'),
util = require('util'),
server = "",
serverStarted = false,
mimeMap = {},
publicFolder = "",
rootFolder = "",
page404 = '404 - Content not found.',
ignoreDir = /(css|js)/,
ignoreFile = /(404|index)\.html/,
master_template = "",
directory_template = "",
video_template = "",
audio_template = "",
dirname = "",
port = "",
doDebug = "",
env = "";

init();

function init() {
    env = (process.versions['node-webkit']) ? 'node-webkit' : 'node-js';
    njSetup();
};

function njSetup() {
    if (env == 'node-js') {
        setup();
    }
};

function nwSetup(sysPath,port_num) {
    processNWArgs(sysPath,port_num);
    setup();    
};

function setup() {
    processArgs();
    loadMimes();
    loadTemplates();    
    startServer();
};

function requestHandler(req, res) {
    var url = decodeURIComponent(req.url);
    url = (url == null) ? "" : url;
    debug("url: "+url);
    debug("rootFolder: "+rootFolder);
    
    if(url === "/") {
        getDirectory("",rootFolder,res);
    } else if(url.substring(0,5) === "/api?") {
        var data = JSON.parse(url.substring(5));
        if(data.reqtype == "directory") {
            var pathName = (data.path == "/") ? "" : data.path;
            var fullPath = rootFolder+pathName;
            debug("fullPath: "+fullPath);
            debug("pathName: "+pathName);
            getDirectory(pathName,fullPath,res);
        } if(data.reqtype == "media") {
            switch(data.media.split("/")[0]) {
            case "video":
                getVideoEmbed(rootFolder,data.path,data.media,res);
                break;
            case "audio":
                getAudioEmbed(rootFolder,data.path,data.media,res);
                break;
            case "image":
            case "text": 
            case "application": 
                getFile(rootFolder, data.path,req,res); 
                break;
            }
        } else if(data.reqtype == "file") {
            debug("reqtype: file: "+data.path);
            getFile(rootFolder, data.path,req,res);
        }
    } else {
        getFile(publicFolder, url.substring(1),req,res);
    }
};
 
/********************************
 *        File Functions        *
 ********************************/

function getFile(filePath,fname,req,res){
    //does the requested file exist?
    fs.exists(filePath+fname,function(exists){
        //if it does...
        if(exists){
            var stat = fs.statSync(filePath+fname);
            var total = stat.size;
            var start = 0;
            var end = (total > 0) ? total-1 : 0;
            var chunksize = total;
            var code = 200;
         
            if(req.headers['range']) {
                var range = req.headers.range;
                var parts = range.replace(/bytes=/, "").split("-");
                var partialstart = parts[0];
                var partialend = parts[1];
                start = parseInt(partialstart, 10);
                end = partialend ? parseInt(partialend, 10) : total-1;
                end = (start <= end) ? end : start;
                chunksize = (end-start)+1;
                code = 206;
            }
         
            var file = fs.createReadStream(filePath+fname, {start: start, end: end});
            res.writeHead(code, { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': getMime(fname), 'Content-Disposition' : contentDisposition(fname, stat)});
            file.pipe(res);
        } else {
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end(page404);
        };
    });
};

function contentDisposition(file, stat) {
    return 'attachment; filename='+path.basename(file)+'; creation-date="'+dateTime(stat.ctime)+'"; modification-date="'+dateTime(stat.mtime)+'"; read-date="'+dateTime(stat.atime)+'";';
};

/********************************
 *      Directory Functions     *
 ********************************/

function getDirectory(root,sysPath,res) {
    fs.readdir(sysPath,function(err,files){
        if(!err){
            debug("root: "+root);
            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(render(directory_template,directoryHTML(root,sysPath,files)));
        } else {
            console.dir(err);
        };
    });
};

function basename(path_name) {
    var base = "";
    debug("pathname b4 base: "+path_name);
    debug("rootFolder b4 base: "+path_name);
    var pathSplit = path_name.split(path.sep);
    var len = pathSplit.length;
    base = (pathSplit[len-1] == "") ? pathSplit[len-2] : pathSplit[len-1];
    debug("basename: "+base);
    return (typeof base == 'undefined') ? basename(rootFolder) : base;
};

function directoryHTML(root, sysPath, files) {
    
    var html = "", file = "";
    
    html += '<p id="dirname">DIR: '+basename(root)+'</p><br>';
    if(root != "" && root != "/") {
        var parent = path.dirname(root);
        debug("parent: "+parent);
        parent = (parent.length == 1 && parent == ".") ? "" : parent;
        debug("parent: "+parent);
        html += trTag(parent,"","[Parent Directory]",fs.statSync(sysPath));
    }
    
    for(var i = 0; i < files.length; i++) {
    
        var stat = fs.statSync(sysPath+files[i]);
        if(files[i][0] == ".") {
            continue;
        } else if(stat.isDirectory()) {
            if(!ignoreDir.exec(files[i])) {
                html += trTag(root,files[i],files[i],stat);
            }
        } else {
            if(!ignoreFile.exec(files[i])) {
                file += trTag(root,files[i],files[i],stat);
            }
        }
    }
    return html+file;
};

function trTag(root,file,text,stat) {
    var mime,name,dlLink,size;
    if(stat.isDirectory()) {
        mime = "dir";
        name = directoryTag(root,file,text);
        dlLink = "---";
        size = "---";
    } else {
        mime = getMime(file);
        name = aTag(root,file,text,mime,"media");
        dlLink = aTag(root,file,"[&#8681;]",mime,"file");
        size = bytesToSize(stat.size);
        //debug("mime: "+mime+" text: "+text);
        if(typeof mime == 'undefined') { mime = 'application/unknown'; }
    }
    
    var m = stat.mtime;
    var month = pad(m.getMonth()+1,2).substring(1);
    var dayInMonth = pad(m.getDate(),2).substring(1);
    var minutes = pad(m.getMinutes(),2).substring(1);
    var date = m.getFullYear()+"/"+month+"/"+dayInMonth+" "+dayInMonth+":"+minutes;
    return '<tr class="'+mime.substring(0,5)+'"><td class="center">'+mime+'</td><td class="left">'+name+'</td><td class="center">'+dlLink+'</td><td class="yellow right">'+size+'</td><td class="yellow left">'+date+'</td></tr>'
};

function directoryTag(root,file,text) {
    //debug("dir: "+root+file);
    return aTag(root,file,text,"text/html","directory");
};

/********************************
 *       Media Functions        *
 ********************************/

 function mediaHTML(filePath,fname,mime,mediaTag) {
    var html = '<p id="fname">'+basename(fname)+'</p><br>';
    html += '<div id="mediaDiv">'
    html += mediaTag("",fname,mime);
    html += '<div id="dlink">'+aTag("",fname,"Download Link",mime,"file")+'</div>';
    html += '</div>'
    return html;
};
 
/********************************
 *       Audio Functions        *
 ********************************/

function getAudioEmbed(filePath,fname,mime,res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(render(audio_template,audioHTML(filePath,fname,mime)));
};

function audioHTML(filePath,fname,mime) {
    var html = '<p id="fname">'+basename(fname)+'</p><br>';
    html += '<div id="mediaDiv">'
    html += audioTag("",fname,mime);
    html += '<div id="dlink">'+aTag("",fname,"Download Link",mime,"file")+'</div>';
    html += '</div>'
    return html;
};

function audioTag(root,file,mime) {
    return '<audio controls><source type="'+mime+'" src="/api?'+getJsonUri("file",root+file,mime)+'"></audio><br>';
};

/********************************
 *       Video Functions        *
 ********************************/

function getVideoEmbed(filePath,fname,mime,res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(render(video_template,videoHTML(filePath,fname,mime)));
};

function videoHTML(filePath,fname,mime) {
    var html = '<p id="fname">'+basename(fname)+'</p><br>';
    html += '<div id="mediaDiv">'
    html += videoTag("",fname,mime);
    html += '<div id="dlink">'+aTag("",fname,"Download Link",mime,"file")+'</div>';
    html += '</div>'
    return html;
};

function videoTag(root,file,mime) {
    return '<video width="320" height="240" controls><source type="'+mime+'" src="/api?'+getJsonUri("file",root+file,mime)+'"></video><br>';
};

/********************************
 *    Generic HTML Functions    *
 ********************************/
 
function aTag(root,file,text,mime,reqtype) {
    var isDir = (reqtype == "directory");
    var target = (reqtype == "file") ? "_tab" : "_self";
    var download = (reqtype == "file") ? " download" : "";
    var url;
    url = getJsonUri(reqtype,root+file,mime);
    return '<a href="/api?'+url+'" type="'+mime+'" target="'+target+'"'+download+'>'+text+'</a><br>';
};

/********************************
 *   Initialization Functions   *
 ********************************/

function processArgs() {
    dirname = (env == 'node-webkit') ? "sms-js/" : __dirname+'/';    
    publicFolder = dirname + 'public/';
    
    if (env == 'node-js') {
        rootFolder = publicFolder + 'root/';
        port = 3000;
        var args = process.argv.splice(2);
        var flag = true;
        var input = false;
        var dir_input = false;
        var port_input = false;
        var state = flag;
        var input_type = "";
        doDebug = false;
        for (var i = 0; i < args.length; i++) {
            if (state == flag) {
                switch(args[i]){
                case '-D':
                case '-d':
                    state = input;
                    input_type = 'dir';
                    break;
                case '-P':
                case '-p':
                    state = input;
                    input_type = 'port';
                    break;
                case 'debug':
                    doDebug = true;
                    break;
                }
            } else if (state == input) {
                switch(input_type){
                case 'dir':
                    if(!dir_input){
                        setRootFolder(args[i]);
                        dir_input = true;
                        debug("Dir Input: "+args[i]);
                    }
                    break;
                case 'port':
                    if(!port_input) {
                        setPort(parseInt(args[i]));
                        port_input = true;
                        debug("Port Input: "+args[i]);
                    }
                    break;
                }
                state = flag;
            }            
        }
    } else {
        doDebug = true;
    }
}

function processNWArgs(sysPath,port_num) {
    doDebug = true;
    debug("cwd: "+process.cwd());
    var path_name = document.getElementById(sysPath).value+path.sep;
    if(path_name == path.sep) { path_name = getUserHome(); }
    debug("nw-path_name: "+path_name);
    setRootFolder(path_name);
    setPort(parseInt(document.getElementById(port_num).value));
};

function loadMimes() {
    mimeMap = JSON.parse(fs.readFileSync(dirname+'assets/mimeTypes.js'));
    //debug(mimeMap);
};

function loadTemplates() {
    master_template = compile("master_template.html");
    directory_template = render(master_template,compile("directory_template.html"));
    video_template = render(master_template,compile("video_template.html"));
    audio_template = render(master_template,compile("audio_template.html"));
};

/********************************
 *   Custom Template "Engine"   *
 ********************************/

function render(template,content) {
    return template.replace("<!--&&-->",content);
};

function compile(fname) {
    return fs.readFileSync(dirname + 'views/'+fname,{encoding:'utf8'});
};
 
/********************************
 *   Node.js Utility Functions  *
 ********************************/

function startServer() {
    server = http.createServer(requestHandler).listen(getPort());
    serverStarted = true;
};

function stopServer() {
    server.close();
    serverStarted = false;
};

function restartServer() {
    stopServer();
    startServer();
};
 
function setRootFolder(root) {
    debug("setRootFolderRoot: "+root);
    var exists = fs.existsSync(root);
    debug("setRootFolderExists: "+exists);
    rootFolder = (exists) ? root : rootFolder;
    debug("setRootFolderResult: "+rootFolder);
};

function setPort(port_num) {
    port = (1024 < port_num && port_num < 65535) ? port_num : port;
};

function getPort() {
    return port;
};

function getExt(fname) {
    return fname.substr((~-fname.lastIndexOf(".") >>> 0) + 2);
};

function getMime(fname) {
    var ext = getExt(fname);
    //debug("ext: "+ext);
    var mime = mimeMap["."+ext];
    //debug("mime: "+mime);
    return mime;    
};

function getUserHome() {
    var userhome = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    return userhome+path.sep;
};

function getJsonUri(reqtype, path, media) {
    path = (reqtype == "directory") ? path+"/" : path;
    return encodeURIComponent(JSON.stringify({reqtype:reqtype, path:path, media:media}));
};

function bytesToSize(bytes) {
   var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
   if (bytes == 0) { return '0 Bytes'; }
   var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
   return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

function pad(num,size) {
    if (typeof(size) !== "number") { size = 2; }
    var s = String(num);
    if (num < 0) { s = s.substring(1); }
    while (s.length < size) { s = "0" + s; }
    if (num < 0) { s = "-"+s; }
    else { s = "+"+s; }
    return s;
};

function dateTime(date) {
    var zone = pad(date.getTimezoneOffset() / -.6,4);
    switch(zone){
    case "-0500": zone = "EST";break;
    case "-0600": zone = "CST";break;
    case "-0700": zone = "MST";break;
    case "-0800": zone = "PST";break;
    }
    var month;
    switch(date.getMonth()){
    case 0: month = "Jan";break;
    case 1: month = "Feb";break;
    case 2: month = "Mar";break;
    case 3: month = "Apr";break;
    case 4: month = "May";break;
    case 5: month = "Jun";break;
    case 6: month = "Jul";break;
    case 7: month = "Aug";break;
    case 8: month = "Sep";break;
    case 9: month = "Oct";break;
    case 10: month = "Nov";break;
    case 11: month = "Dec";break;        
    }
    var day;
    switch(date.getDay()){
    case 0: day = "Sun";break;
    case 1: day = "Mon";break;
    case 2: day = "Tue";break;
    case 3: day = "Wed";break;
    case 4: day = "Thu";break;
    case 5: day = "Fri";break;
    case 6: day = "Sat";break;  
    }
    
    var hour = pad(date.getHours(),2).substring(1);
    var minute = pad(date.getMinutes(),2).substring(1);
    var second = pad(date.getSeconds(),2).substring(1);
    
    return day+", "+date.getDate()+" "+month+" "+date.getFullYear()+" "+hour+":"+minute+":"+second+" "+zone;
};

function debug(obj) {
    if(doDebug) { if(console != null) { console.log(obj); } }
};

/********************************
 *   Node.nw Utility Functions  *
 ********************************/

function nwRestartServer(sysPath, port_num) {
    processNWArgs(sysPath, port_num);
    restartServer();
};

function toggleFormVisibility() {
    var startForm = document.getElementById("startForm");
    var stopRestartForm = document.getElementById("stopRestartForm");
    startForm.style.display = (startForm.style.display == 'none') ? '' : 'none';
    stopRestartForm.style.display = (stopRestartForm.style.display == 'none') ? '' : 'none';
};

