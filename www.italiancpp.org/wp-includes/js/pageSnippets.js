/**This file has the javascript that enables the compilable scripts in the ++It articles and
forums. Place at /italiancpp.org/htdocs/wp-includes/js. It is included from the general theme header (header.php).

There is a lot of "commonality" (read: copy paste) with the onlineCompiler.js script.

To add another compiler:
	1) Update Compilers: add another element to compilerParameters.
	2) In case the new compiler is hosted in a new online service, update GetCommandString to return the POST content for that service.

Copyright: the ++It team. Under MIT license. */


/**    General purpose encoders and string manipulation.     */
/**HTML encoding, for safety.*/
 function HtmlEncode(value){
  return jQuery('<div/>').text(value).html();
}
function HtmlDecode(value){
  return jQuery('<div/>').html(value).text();
}


/**Count the lines in a string of text.*/
function CountLines(text) {
    return text.split("\n").length;
}

/** Removes any "\n" that may be present at the beginning or at the end of a 2 or more chars long string.*/
function TrimNewlines(text) {
	var textSize = text.length;
	if (textSize > 1) { //There must be at least two line endings to remove.
		if (text[textSize - 1] == "\n")  //Start from the back: text[0] will be untouched. If instead you shorten the string textSize does not match anymore.
			text = text.substring(0, textSize - 1);
		if (text[0] == "\n")
			text = text.substring(1);
	}
	return text;
}


/**    UI elements creation.     */
/** Changes the given element into a ACE editor.
Makes it big enough to show all the text content it has inside.*/
function MakeEditor(baseElementId, aceEditorId) {
	var target = document.getElementById(baseElementId); //We transform this into an editor.

	var cleanedUpText = target.textContent;  //Wordpress will do incredible transformations. This give us just the code.
   
    //Create the editor.
	var editor =  ace.edit(baseElementId);
	editor.setTheme("ace/theme/textmate");
    editor.getSession().setMode("ace/mode/c_cpp");
    editor.setFontSize("13px"); //The CSS has no effect!
	editor.setAutoScrollEditorIntoView();
	editor.setOption("maxLines", 100);
	
	editor.getSession().setUseWrapMode(false);
	
	var code = cleanedUpText;
	code = TrimNewlines(code);            //Remove the initial/final blank line.
	editor.getSession().setValue(code);
		
	//There may be multiple editors. We store them by ID into the window object (not sure that this is the best way).
	window[aceEditorId] = editor;
	
	//editor.renderer.setShowGutter(false);
	
	return editor; //So that the caller can manipulate it.
}




/**Set the onclick event of the button identified by buttonId so that it calls the function to compile the code
in the editor marked by editorId and write the result in the div called outputId.*/
function MakeCompileButton(buttonId, editorId, outputId, compilerSelectorId)
{
   var compileButton = document.getElementById(buttonId);
   compileButton.onclick = function(event) { CompileAndRunWithTargets(editorId, outputId, compilerSelectorId); };
   return compileButton;
}

/**Use the DIV identified by baseElementId as a base to create a non-editable snippet in a ACE editor.
It will set the editor as read only.

HTML must be like this (_id_ --> baseElementId):
<DIV class="page-snippet-container">
	<div id={{_id_}} class='ace_coliru_editor'>{{content}}</div>
<script type="text/javascript">TurnIntoSnippet('{{_id_}}');</script>
</DIV>
*/
function TurnIntoSnippet(baseElementId) {
	var aceEditorId = "ace_" + baseElementId;
	var editor = MakeEditor(baseElementId, aceEditorId);
	editor.setReadOnly(true);
}

/** Use the DIV identified by baseElementId to create a editor. 

The HTML must look like this (_id_ --> baseElementId):
<DIV>
<DIV class="page-snippet-container">
	<div id={{_id_}} class='ace_coliru_editor'>{{content}}</div>
</DIV>
	<INPUT id="{{_id_}}_compile" class="page-snippet-button" type="button" value="Esegui">
	<!-- Optional SELECT tag with id="{{_id_}}_compiler_select" could be here. -->
	<DIV id="{{_id_}}_output" class="page-snippet-container"></DIV>
<script type="text/javascript">
	TurnIntoCompiler('{{_id_}}');
</script>
</DIV>
*/
function TurnIntoCompiler(baseElementId)
{
   //Compute identifiers.
   var aceEditorId = "ace_" + baseElementId
   var outputBoxId = baseElementId + "_output";
   var compileButtonId = baseElementId + "_compile" 
   var compilerSelectorId = baseElementId + "_compiler_select"
  
   //Create the editor.
   var editor = MakeEditor(baseElementId, aceEditorId);
   
   //Optionally fills the compiler options.
   PopulateCompilerSelector(compilerSelectorId);

   //Set the callback in the button.
   var compileButton = MakeCompileButton(compileButtonId, aceEditorId, outputBoxId, compilerSelectorId);
}


function PopulateCompilerSelector(compilerSelectorId) {
	var selector = document.getElementById(compilerSelectorId);
	if (selector == undefined)
		return; //Optional selector is not there: halt.
	
	//Do this in the pedestrian was as jQuery may not be there.
	var compilers = Compilers();
	for (compiler in compilers) {
		var selectOption = document.createElement("option");
		selectOption.text = compiler;
		selectOption.value = compiler;
		selector.appendChild(selectOption);
		console.log(selector);
    }
}

/** Contains the options for our compilers. (Masks a global variable).
Returns the appropriate command line, url and command string to post for each compiler.
Data is fixed and hardcoded. The compilation command must be as useful as possible, because it is fixed.
So, include everything that you can think of (well, almost...).
Oct 2016 - Added -lboost_context.
*/
function Compilers() {
	var kColiruBaseCommand = "-std=c++1z -pthread -lboost_context -Wall main.cpp && ./a.out";
	var kColiruUrl = "http://coliru.stacked-crooked.com/compile";
	
	var compilerParameters = {}
	compilerParameters["clang"] = {"compilationCommand" : "clang++ " + kColiruBaseCommand, "url" : kColiruUrl, "targetOnlineCompiler" : "coliru"};
	compilerParameters["gcc"] = {"compilationCommand" : "g++-4.8 " + kColiruBaseCommand, "url" : kColiruUrl, "targetOnlineCompiler" : "coliru"};
	//Add here other possibilities.
	
	return compilerParameters
}


/**Needed to avoid overlapping compilation jobs.*/
var gCompilationInProgress = false; //DO NOT TOUCH! Only CompileAndRunWithTargets and CompilationCallback can access this!

/** Reads the select input called selectorId and returns the chosen compiler.
Defaults to clang if the compiler selection is undefined (because the selector is optional).*/
function SelectCompiler(selectorId) {
	var selector = document.getElementById(selectorId);
	
	if (selector == undefined)
		return "clang";
	
	var option = selector.options[selector.selectedIndex].value;
	return option;
}

/** Prepare the online compiler command string.*/
function GetCommandString(compilerParams, code) {
	
	if (compilerParams["targetOnlineCompiler"] == "coliru")
		return JSON.stringify( { "cmd": compilerParams["compilationCommand"], "src": code });
		
	//Else we have an error because we support only coliru. There are plans to support VC++ on another online service.
	return "ERROR";
}

/**Grab the code, call the compiler, set the callback.*/
function CompileAndRunWithTargets(editorId, outputId, compilerSelectorId) {
	//Guard: one compilation at a time.
	if (gCompilationInProgress == true)	{
		DumpOutput("L'esecuzione precedente non e' ancora terminata.\nAttendere...", outputId);
		return;
	}
	
	//Start a new compile-execute pass.
	gCompilationInProgress = true;
	DumpOutput("Attendere...", outputId);
	
	//Grab the code.
	var code = window[editorId].getSession().getValue();
	
	//Grab the compiler-specific options and the online service command.
	var compiler = SelectCompiler(compilerSelectorId);
	var compilerParameters = Compilers()[compiler];  //No provision for undefined parameters.
	var onlineCompilerCommand = GetCommandString(compilerParameters, code);
	
	//Call the online compiler.
	var http = new XMLHttpRequest();
	http.onreadystatechange=function() {
		if (http.readyState==4 && http.status==200)
			CompilationCallback(http.responseText, outputId);
	}
	http.open("POST", compilerParameters["url"], true);
	http.send(onlineCompilerCommand);
}


/**Prints the result of the compilation and mark the run as completed.*/
function CompilationCallback(result, outputId) {
	DumpOutput(result, outputId);
	gCompilationInProgress = false;
}


/**Write some text in the DIV called outboxId, in a PRE element and with HTML sanitation.*/
function DumpOutput(output, outboxId) {
	//Create a new text element in a PRE.
	var textNode = document.createTextNode(output);
	var formatterTextTag = document.createElement("PRE");
	formatterTextTag.appendChild(textNode);
	
	//Replace content with the new text element.
	var outbox = document.getElementById(outboxId);
	outbox.innerHTML = "";
	outbox.appendChild(formatterTextTag);
}

function Sanitize(text) {
	var kMaxAllowedOutputLengthChars = 5000;

	var cleanText = String(text).substring(0, kMaxAllowedOutputLengthChars);
	if (text.length > kMaxAllowedOutputLengthChars)	{
		cleanText = cleanText + "...\n[output troppo lungo!]";
	}

	cleanText = HtmlEncode(cleanText); //We check the articles for publication, but just in case...

	return cleanText;
}

