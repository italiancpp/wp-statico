//Collections of javascript functions to support the embedding of online compilers.
// /italiancpp.org/htdocs/wp-includes/js
// http://www.italiancpp.org/wp-includes/js/onlineCompiler.js
// MIT License, copyright ++It, the Italian C++ Community.

/**Page option management. 

Do not access gDefaultOptions directly.
To have an element to change the options on a page, call it option-<optionName>.
Every possible option is supposed to have a default.
*/
var gDefaultOptions = {"fontSize":"14", 
					   "compiler":"g++-4.8",
					   "compilerOptions":"-std=c++1y -pthread",
					   "searchSite":"cppreference",
                       "stdin":""};

function getDefaultOption(name) {
	return gDefaultOptions[name];
}

function itc_getOptionPageElement(name) {
	return "option-" + name;
}

function itc_getOption(name) {
	optionElementOnPageId = itc_getOptionPageElement(name);
	var value = "NOT AN OPTION";
	
	selector = document.getElementById(optionElementOnPageId);
	if (! selector) { //Not all pages where we use the compiler allow to choose the options.
		value = getDefaultOption(name);
	} else {
		value = selector.value;
	}
	
	return value;
}

function itc_setAllOptions(optionMap) {
	for (name in optionMap) {
		value = optionMap[name];
		whereToWrite = document.getElementById(itc_getOptionPageElement(name));
		whereToWrite.value = value;
	}
}

function itc_saveOptions() {
	var liveOptions = {};
	for (optionName in gDefaultOptions) {
		liveOptions[optionName] = itc_getOption(optionName);
	}
	ITCCookie.saveOptions(liveOptions)
}

function itc_loadOptions() {
	var loadedOptions = ITCCookie.loadOptions();
	itc_setAllOptions(loadedOptions);
	itc_applyOptions();
}

function itc_restoreDefaultOptions() {
	itc_setAllOptions(gDefaultOptions);
	itc_applyOptions();
}

 //Breaks encapsulation, but have to change the page in case options are changed!
function itc_applyOptions() {
	UIHelper.setFontSize();
	itc_setRadioButton("searchSite");
}

/**This relies on having buttons named option-optionName-optionValue*/
function itc_setRadioButton(optionName) {
	var buttonName = itc_getOptionPageElement(name) + "-" + itc_getOption(name);
	var radioButton = document.getElementById(buttonName);
	if (radioButton) //Should never be null. TODO! FIX!
		radioButton.checked = true;
}

function itc_storeRadioButton(optionName, value) { //TODO must go in teh UI helper.
	var optionElementName = itc_getOptionPageElement(optionName);
	storageElement = document.getElementById(optionElementName);
	storageElement.value = value;
}



function itc_restoreUiStatus() {
	var uiStatus = ITCCookie.loadUiStatus();
	
	jQuery('#outbox').height(uiStatus["outboxHeight"]);
	jQuery('#editor').height(uiStatus["editorHeight"]);
	
	ITCEditor.GetInstance().getEditor().resize();
}


/**Create a goTo() jQuery function to scroll the page to the desired element (jQuery('#outbox').goTo();")*/
(function($) {
    $.fn.goTo = function() {
        $('html, body').animate({
            scrollTop: ($(this).offset().top -40) + 'px'
        }, 1000);
        return this; // for chaining...
    }
})(jQuery);

/**General purpose encoder.*/
 function htmlEncode(value){
  return jQuery('<div/>').text(value).html();
}

/**Shorthand for the resize (keep the html event readable).*/
function editorResize() {
    ITCEditor.GetInstance().getEditor().resize();
}

function saveBeforeUnload() { //Think also "shutdown sequence".
	//Collect stuff to save
	var uiStatus = UIHelper.getStatus();
    var code = ITCEditor.GetInstance().getCode();
	//Save it.
	ITCCookie.saveCode(code);
	ITCCookie.saveUiStatus(uiStatus);
}

function startupSequence() {
    SearchBox.initKeyListener();				//Initialize the search
	ITCEditor.GetInstance().setInitialCode();	//The ACE editor.
	UIHelper.initialUiSetup(); 					//Initialize the page after the ace editor (otherwhise it won't be resizable anymore - ace init changes it).
 
	//Must be here - does not work as a "free line" like the startup callback because something else overrides the event.
	window.onbeforeunload = saveBeforeUnload; //Save code before exiting the page.

	//Finally, load any saved option
    itc_loadOptions();
    itc_restoreUiStatus();
}
//Window-level callbacks.
window.onload = startupSequence; //Set up everything at page load.



/**Low level cookies management: save and load functions.*/
function ITCCookie (type) {}
ITCCookie.cookieName = "it-compiler-data";
ITCCookie.saveInCookie = function(key, value) {
	var dataObject = ITCCookie.loadCookie(key)
	dataObject[key] = value;

	var encodedData = JSON.stringify(dataObject);
	jQuery.cookie(ITCCookie.cookieName, encodedData, {path: "/compiler", domain: "www.italiancpp.org", expires: 30});
}
ITCCookie.loadCookie = function() {
	var encodedData = jQuery.cookie(ITCCookie.cookieName);
	
	if (!encodedData) //Nothing saved, nothing to load.
		return {}; //Return a "empty"
		
	var loadedData = JSON.parse(encodedData);
	return loadedData;
}
ITCCookie.loadFromCookie = function(key) {
	var loadedData = ITCCookie.loadCookie();
	return loadedData[key];
}
ITCCookie.loadCode = function() {
	return ITCCookie.loadFromCookie("currentCode");
}
ITCCookie.saveCode = function(code) {
	ITCCookie.saveInCookie("currentCode", code);
}
ITCCookie.loadOptions = function() {
	return ITCCookie.loadFromCookie("options");
}
ITCCookie.saveOptions = function(options) {
	ITCCookie.saveInCookie("options", options);
}
ITCCookie.saveUiStatus = function(uiStatus) {
	ITCCookie.saveInCookie("uiStatus", uiStatus);
}
ITCCookie.loadUiStatus = function() {
	return ITCCookie.loadFromCookie("uiStatus");
}

/** Credits to https://www.html5rocks.com/en/tutorials/cors/ */
function createCORSRequest(method, url) {
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr) {
    xhr.open(method, url, true);
  } else if (typeof XDomainRequest != "undefined") { // IE-specific
    xhr = new XDomainRequest();
    xhr.open(method, url);
  } else {
    console.log("No CORS!");
    xhr = null;
  }
  return xhr;
}

/**Handles all the coliru operations (ajax calls, archive...).*/
function ColiruFacade (type) {}
/**Send a query to coliru, pass the result back to the callback function (callback.receiveCompilationResult).*/
ColiruFacade.compile = function (code, command, callback) {
	var http = createCORSRequest("POST", "http://coliru.stacked-crooked.com/compile");
	http.onreadystatechange=function() {
		if (http.readyState==4 && http.status==200)
			callback.receiveCompilationResult(http.responseText);
	}
	http.send(JSON.stringify( { "cmd": command, "src": code }));
}
	
/**Load/archive code from/to coliru.*/
ColiruFacade.loadColiruCode = function() {
	//See if we have a archive URL.
	var possibleId = ColiruFacade.getColiruCodeId();
	if(possibleId != "") {
		var codeId = ColiruFacade.getColiruCodeId();
		var coliruAnswer = ColiruFacade.queryColiruArchive(codeId);
		var coliruData = JSON.parse(coliruAnswer);
		return coliruData["src"];
	}
	return; //undefined
}

ColiruFacade.getColiruCodeId = function() { //expected url structure: www.whatever.com/<coliruId>
	var location = window.location;
	var codeId = window.location.search.substring(1);
	if (codeId.search('&') != -1)
		return ""; //We captured unexpected parameters.
	return codeId;
}

ColiruFacade.queryColiruArchive = function(codeId) {
	var coliruArchiveUrl = "http://coliru.stacked-crooked.com/archive?id=" + codeId;
	var http = new XMLHttpRequest();
	http.open("GET", coliruArchiveUrl, false);
	http.send();
	if (http.readyState==4 && http.status==200)
		return http.responseText;
	else
		return "Archiviazione fallita.";
}

ColiruFacade.archiveCodeOnColiru = function() {
	var code = ITCEditor.GetInstance().getCode();
	var compileCommand = ITCEditor.GetInstance().generateShellCommand();
	var archiveAddress = "http://coliru.stacked-crooked.com/share"

	var http = new XMLHttpRequest();
	http.open("POST", archiveAddress, false);
	http.send(JSON.stringify( { "cmd": compileCommand, "src": code }));
	
	var codeId = http.responseText; //TODO!!! Sanitize?
	var coliruViewerUrl = "http://coliru.stacked-crooked.com/a/" + codeId;
	var italianCppUrl = "http://www.italiancpp.org/compiler?"  + codeId;
	
	UIHelper.setArchiveLinks(coliruViewerUrl, italianCppUrl);
}


/**Class to collect all the behavior related to the global editor and the special "++It addons".*/
function ITCEditor (type) {
	//Change the editor box into an editor. //TODO: get the name as parameter?
		this.editor = ace.edit("editor");
		this.editor.setTheme("ace/theme/textmate");
		this.editor.getSession().setMode("ace/mode/c_cpp");
		
		//Autocomplete
		ace.require("ace/ext/language_tools");
		this.editor.setOptions({ enableBasicAutocompletion: true, enableSnippets: true});
		
		//Compilation shortcut.
		var thisInScope = this;
		this.editor.commands.addCommand({
			name: 'compileShortcut',
			bindKey: {win: 'Ctrl-F7'},  //how to bind to mouse?
			exec: function(e) {
				thisInScope.compileAndRun();
			},
			readOnly: true // Do not compile read only snippets.
		});
		
		this.compilationInProgress = false;
		this.codeAnnotations = [] //This is redundant, but getAnnotations returns a number instead of an array of annotations. It is easier to handle them this way.
		//End of construction.
	
	
	/**Returns whatever word is under the cursor.*/
	this.getWordUnderCursor = function() {
		this.editor.getSession().getSelection().selectWord(); //Select word under cursor
		var selectedWord = this.editor.session.getTextRange(this.editor.getSelectionRange()); //Copy the selected word in a variable.
		return selectedWord;
	}
	
	
	/**Writes the default code in the editor. Either the last code saved before the page unload, or the hello world.*/
	this.setInitialCode = function() {
		//Basic code is the hello world.
		var code = "#include <iostream>\n" +
				"using namespace std;\n\n" +
				"int main()\n" +
				"{\n" + 
				"   cout << \"Questo e' il nostro compilatore online!\" << endl;\n" +
				"}\n";

		//Try the archive first.
		var coliruCode = ColiruFacade.loadColiruCode();
		if (coliruCode){
			code = coliruCode;
		} else {
			//It was not a archive request: check the coockie.
			var localCode = ITCCookie.loadCode();
			if (localCode) 
				code = localCode;
		}
		
		this.getEditor().setValue(code, 1);  //1 means "cursor at end of text".
		this.compileAndRun(); //Compile the initial code.
	}
	
	
	/**Returns the internal ACE editor.*/
	this.getEditor = function() {
		return this.editor
	}
	
	
	/**Returns a string with the editor content.*/
	this.getCode = function() {
		return this.getEditor().getValue();
	}
	
	/**First part of the compilation (before the call to coliru).*/
	this.compileAndRun = function() {
		if (this.compilationInProgress == true)	{
			UIHelper.dumpOutput("L'esecuzione precedente non e' ancora terminata.\nAttendere...");
			return;
		}
	
		this.compilationInProgress = true
		UIHelper.dumpOutput("Attendere...");     //Tell the user to wait.
		ColiruFacade.compile(this.getCode(), this.generateShellCommand(), this)
	}
	
	
	/**Handles the result coming from coliru.*/
	this.receiveCompilationResult = function(responseText) {
		var result = this.sanitize(responseText);
		UIHelper.dumpOutput(result);
		this.cleanCompilationErrors(); //remove old errors
		this.markCompilationErrors(result);
		this.compilationInProgress = false;
	}
	
	
	/**Takes care of the encoding, truncation and other "anti hacks".*/
	this.sanitize = function (text){
		var kMaxAllowedOutputLengthChars = 5000;
		
		var cleanText = String(text).substring(0, kMaxAllowedOutputLengthChars);
		if (text.length > kMaxAllowedOutputLengthChars)	{
			cleanText = cleanText + "...\n[output troppo lungo!]";
		}
	
		// cleanText = htmlEncode(cleanText); Not needed - they can inject garbage, but only in their own browser.
	
		return cleanText;
	}

	
	this.cleanCompilationErrors = function() {
		this.getEditor().session.clearAnnotations();
		this.codeAnnotations = [];
	}
	
	
	this.markCompilationErrors = function (compilerOutput) {
		var lines = compilerOutput.split("\n");
		for (var i=0;i<lines.length;i++) {
			var currentLine = lines[i];
			var errorPos = currentLine.search(/main.cpp:[0-9]+:[0-9]+/);
			if (errorPos != -1) {
				var errorElements = currentLine.split(":"); //main.cpp:<line>:<column>...
				var lineNumber = parseInt(errorElements[1]);
				this.codeAnnotations.push({row:lineNumber -1 ,column: 0, text: currentLine, type:"error"})
			}
		}
	  this.getEditor().session.setAnnotations(this.codeAnnotations); 
	}

	this.showCommandLine = function(){
		UIHelper.dumpOutput(this.generateShellCommand());
	}
	
	/**Compute the shell command to compile the code.*/
	this.generateShellCommand = function()
	{
		var compiler = itc_getOption("compiler");
		var options = itc_getOption("compilerOptions");
        var stdin = itc_getOption("stdin");
		var command = compiler + " " + options + " main.cpp" //Compile...
		var command = command + " && echo '" + stdin + "' | ./a.out";       //...and if compilation was ok (&&) run.
		return command;
		//Notice that && can't be used in scripts embedded in web pages (is escaped).
	}
}

ITCEditor.instance = undefined; //DO NOT ACCESS DIRECTLY! Singleton pattern.

/**Create and initialize on 1st use the editor.
It assumes a hardcoded DIV with ID "editor" is present on the page.
TODO: make more general for the snippets?
*/
ITCEditor.GetInstance = function () {
	if (ITCEditor.instance == undefined) {
		ITCEditor.instance = new ITCEditor();
	}
	return ITCEditor.instance;
};



/**This class has the logic needed to search on other sites, including the search command (clicks etc).*/
function SearchBox (type) { }
SearchBox.cntrlIsPressed = false; 

/**Retgisters the keydown/keyup events.*/
SearchBox.initKeyListener = function(){
	jQuery(document).keydown(function(event){
		if(event.which=="17")
			SearchBox.cntrlIsPressed = true;
	});

	jQuery(document).keyup(function(){
		SearchBox.cntrlIsPressed = false;
	});
}


/**This should be called on mouse up, so that the click action (move the ACE cursor) is already completed.*/
SearchBox.comboClick = function () {
    if(SearchBox.cntrlIsPressed) {  //Control + click
		SearchBox.documentationSearch();
    }
}


/**Implements the actual documentation search.*/
SearchBox.documentationSearch = function() {
	var kBaseCppreferenceUrl = "http://en.cppreference.com/mwiki/index.php?title=Special%3ASearch&search="
	var kBaseCplusplusUrl = "http://www.cplusplus.com/search.do?q="

	var baseSearchURL = kBaseCppreferenceUrl //This is also the default.
	if (itc_getOption("searchSite") == "cplusplus") 
	  baseSearchURL = kBaseCplusplusUrl;

	var keyword = ITCEditor.GetInstance().getWordUnderCursor();
    var searchUrl = baseSearchURL + keyword;
    UIHelper.openSearchBox(searchUrl);
}


/**Class to collect methods to manipulate the page elements.*/
function UIHelper (type) {}
/**Set the URL in the search sub-page and opens it.*/
UIHelper.openSearchBox = function (searchURL){
	document.getElementById('searchPage').src = searchURL;
	jQuery( "#searchBox" ).dialog( "open" );
	document.getElementById("searchBox").style.top = 150;
}

/**Methods to set fonts.*/
UIHelper.setFontSize = function () {
    var selectedSize = itc_getOption("fontSize")
	var numericalSize = parseInt(selectedSize);
	if (numericalSize < 8)
		selectedSize = "8";
	if (numericalSize > 25)
		selectedSize = "25"
	selectedSize = selectedSize + "pt";
    UIHelper.setFontSizeElement('editor', selectedSize);
    UIHelper.setFontSizeElement('outbox', selectedSize) ;
}

UIHelper.setFontSizeElement = function (elementId, size){
	var target = document.getElementById(elementId);
	target.style.fontSize = size;
}

/**Things to do to initialize the UI.*/
UIHelper.initialUiSetup = function () {
//Close the things that have to start hidden.
	jQuery('#compilerToolbar').hide(); 
	jQuery('#advancedTools').hide();
	jQuery('#instructions').hide();

	//Make the editor resizable (vertically only).
	jQuery(function() {
		jQuery("#editor").resizable({
							maxWidth: 738,
							minWidth: 738});
	});
	
	//Font option as a jQuery spinner.
	jQuery( "#option-fontSize" ).spinner({ max: 25, min: 8, 
                                      change: UIHelper.setFontSize, spin: UIHelper.setFontSize
                                      }).val(14);

	//Transform the search box in a modal pop-up.
    jQuery(document).ready(function($){
      $("#searchBox").dialog({modal: true, autoOpen: false, height: 500, width: 730,
                             show: {effect: "blind", /*gives some time to load a new page.*/
                                     duration: 1000 }
                              });
       });
}

/**Write the parameter in the output place.*/
UIHelper.dumpOutput = function(output) {
	//Create a new text element in a PRE.
	var textNode = document.createTextNode(output);
	var formatterTextTag = document.createElement("PRE");
	formatterTextTag.appendChild(textNode);
	
	//Replace content with the new text element.
	var outbox = document.getElementById("outbox");
	outbox.innerHTML = "";
	outbox.appendChild(formatterTextTag);
	//return ("<PRE>" + text + "</PRE>"); is unsafe! text could be "</PRE> ...attack code...".
	//Notice that <PRE> can't be used in web pages. Crayon will override it. Just break it: return "<PR" + "E>" + ...

   outbox.style.height = UIHelper.getBoxHeightPixels(output, outbox);
}

/**Computes how many pixesl the container must be to contain the text. Directly returs a css directive.*/
UIHelper.getBoxHeightPixels = function(text, container){
    var kMargin = 50;
	var pixelsPerRow = UIHelper.getTextHeigthPx(container); //TODO pull in this class
	var heightLimit = UIHelper.getMaxHeightPx(container);  //Prevent (?) to "hack" the page using a inordinate amount of output.
    var rowsNumber = text.split("\n").length;
	var height = rowsNumber * pixelsPerRow + kMargin;
	
	if (height > heightLimit)
		height = heightLimit;
	if (height < 0)    //Underflow (or programming error).
		height = pixelsPerRow;
    var cssDirective = height + "px";
    return cssDirective;
}

UIHelper.getTextHeigthPx = function(element) {
	var style = window.getComputedStyle(element, null).getPropertyValue('font-size');
	var fontSize = parseFloat(style); 
	return fontSize;
}

UIHelper.getMaxHeightPx = function (element) {
    style = window.getComputedStyle(element, null),
    value = style.getPropertyValue("max-height");
	return parseFloat(value); 
}

/**Scripts to animate the buttons.*/
UIHelper.optionButtonScript = function (){
    if(jQuery('#compilerToolbar').is(':hidden')) {  
	//If hidden, we are about to open, so we can go to it.
	//Don't test after the toggle, I think it does not change until after the anymation delay.
        jQuery('#optionsButton').goTo();
    }
    jQuery('#compilerToolbar').toggle('blind'); //Open (or close).
}

UIHelper.closeOptionScript = function () {
	jQuery('#compilerToolbar').toggle('blind');
	jQuery('#editor').goTo();
}

UIHelper.helpButtonScript = function (){
	jQuery('#instructions').toggle('blind');
	jQuery('#instructions').goTo(); //Todo: goto only on open
}

UIHelper.closeButtonScript  = function () {
	jQuery('#instructions').toggle('blind');
	jQuery('#editor').goTo();
}

UIHelper.setArchiveLinks = function(coliruViewerUrl, italianCppUrl) {	
	var linkBox = document.getElementById("archiveCodeLinks");
	var links = "<a href='" + coliruViewerUrl + "'>" + coliruViewerUrl + "</a></br><a href='" + italianCppUrl + "'>" + italianCppUrl + "</a>";
	linkBox.innerHTML = links;
}

UIHelper.getStatus = function() {
	var uiStatus = {};
	uiStatus["outboxHeight"] = jQuery('#outbox').height();
	uiStatus["editorHeight"] = jQuery('#editor').height();
	return uiStatus;
}