const setupDialog = document.getElementById("setup");
const setupPrompt = document.getElementById("setup-prompt");
const setupConfirm = document.getElementById("setup-confirm");
const editDialog = document.getElementById("edit");
const editPrompt = document.getElementById("edit-prompt");
const editConfirm = document.getElementById("edit-confirm");
//const editContext = document.getElementById("edit-context");
const iframe = document.getElementById("iframe");

let code = "";

function requestCompletion(previous, instruction) {
    return "<!DOCTYPE html><html><body><p>HELLO</p></body></html>";
}

function eventizeDOM(dom) {
    if(dom.children.length == 0){
	dom.addEventListener("click", (evt) => {
    	    evt.stopPropagation();
	    editDialog.showModal();
	});
    } else {
	for(let children of dom.children) {
	    eventizeDOM(children);
	}
	dom.addEventListener("click", (evt) => {
	    evt.stopPropagation();
	    editDialog.showModal();
	});
    }
}

function sanitizeCode(code) {
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(code, "text/html");
    eventizeDOM(htmlDoc);
    return htmlDoc;
}

function main() {
    const data = setupDialog.showModal();

    setupPrompt.addEventListener("change", () => {
	setupConfirm.value = setupPrompt.value;
    });

    setupDialog.addEventListener("close", async () => {
	code = await requestCompletion("", setupDialog.returnValue);
	const safeCode = sanitizeCode(code);
	iframe.contentDocument.body = safeCode.body;
    });

    editPrompt.addEventListener("change", () => {
	editConfirm.value = editPrompt.value;
    });

    editDialog.addEventListener("close", async () => {
	code = await requestCompletion(code, editDialog.returnValue);
	const safeCode = sanitizeCode(code);
	iframe.contentDocument.body = safeCode.body;
    });
}

window.addEventListener("load", main);
