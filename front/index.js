const setupDialog = document.getElementById("setup");
const setupPrompt = document.getElementById("setup-prompt");
const setupConfirm = document.getElementById("setup-confirm");
const editDialog = document.getElementById("edit");
const editPrompt = document.getElementById("edit-prompt");
const editConfirm = document.getElementById("edit-confirm");
const iframe = document.getElementById("iframe");
const clippy = document.getElementById("clippy");
const loadingSkely = document.getElementById("loading-skely");
const hearing = document.getElementById("hearing");
const goBack = document.getElementById("go-back");
const goForward = document.getElementById("go-forward");


let code = [];
let codePos = -1;

const context = {
    "id": "",
};

function uuidv4() {
  const uuid = new Array(36);
  for (let i = 0; i < 36; i++) {
    uuid[i] = Math.floor(Math.random() * 16);
  }
  uuid[14] = 4; // set bits 12-15 of time-high-and-version to 0100
  uuid[19] = uuid[19] &= ~(1 << 2); // set bit 6 of clock-seq-and-reserved to zero
  uuid[19] = uuid[19] |= (1 << 3); // set bit 7 of clock-seq-and-reserved to one
  uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
  return uuid.map((x) => x.toString(16)).join('');
}

function enableHistory() {
    goBack.src = "arrow.webp";
    goForward.src = "arrow.webp";
}

async function requestCompletion(code, next_prompt) {
    const requestBody = {
	"previous_code": code,
	"next_prompt": next_prompt,
	"next_id": context.id,
    };
    loadingSkely.style.visibility = "inherit";
    const request = await fetch("/", {
	method: "POST",
	headers: {
	    "Content-Type": "application/json"
	},
	body: JSON.stringify(requestBody),
    });
    loadingSkely.style.visibility = "hidden";    
    const json = await request.json();
    return json["new_code"];
}

async function requestDiffCompletion(id, next_prompt) {
    const requestBody = {
	"diff": iframe.contentDocument.getElementById(id).outerHTML,
	"next_prompt": next_prompt,
    };
    loadingSkely.style.visibility = "inherit";
    const request = await fetch("/diff", {
	method: "POST",
	headers: {
	    "Content-Type": "application/json"
	},
	body: JSON.stringify(requestBody),
    });
    loadingSkely.style.visibility = "hidden";
    const json = await request.json();
    iframe.contentDocument.getElementById(id).outerHTML = json["new_diff"]
    code.push(iframe.contentDocument.documentElement.outerHTML);
    codePos = code.length - 1;
}

function eventizeDOM(dom) {
    if(dom.children.length == 0){
	dom.id = uuidv4();
	dom.addEventListener("click", (evt) => {
    	    evt.stopPropagation();
	    dom.style.border = "0px";
	    editPrompt.value = "";
	    editDialog.showModal();
	    context.id = evt.target.id;
	});
	dom.addEventListener("mouseenter", (evt) => {
    	    evt.stopPropagation();
	    dom.style.border = "5px solid red";
	})
	dom.addEventListener("mouseleave", (evt) => {
    	    evt.stopPropagation();
	    dom.style.border = "0px";
	})
    } else {
	for(let children of dom.children) {
	    eventizeDOM(children);
	}
	dom.id = uuidv4();	
	dom.addEventListener("click", (evt) => {
	    evt.stopPropagation();
	    editPrompt.value = "";
	    editDialog.showModal();
	    context.id = evt.target.id;
	});
    }
}

function sanitizeCode(code) {
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(code, "text/html");
    eventizeDOM(htmlDoc);
    return htmlDoc;
}

async function restart() {
    return await fetch("/restart", {
	method: "POST"
    });
}

async function main() {
    await restart();
    setupPrompt.value = "";
    const data = setupDialog.showModal();

    setupPrompt.addEventListener("change", () => {
	setupConfirm.value = setupPrompt.value;
    });

    setupDialog.addEventListener("close", async () => {
	if(setupDialog.returnValue === "$cancel") {
	    //await recordAudioAndRequestCompletion();
	} else {
	    code.push(await requestCompletion("", setupDialog.returnValue));
	    codePos = code.length-1;
	    const safeCode = sanitizeCode(code[codePos]);
	    iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
	    iframe.contentDocument.body = safeCode.body;
	    enableHistory();
	}
    });

    editPrompt.addEventListener("change", () => {
	editConfirm.value = editPrompt.value;
    });

    editDialog.addEventListener("close", async () => {
	if(editDialog.returnValue !== "$cancel"){
	    if(context.id === ""){
	        code.push(await requestCompletion(code[codePos], editDialog.returnValue));
		codePos = code.length - 1;
	        const safeCode = sanitizeCode(code[codePos]);
	        iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
		iframe.contentDocument.body = safeCode.body;
	    } else {
		await requestDiffCompletion(context.id, editDialog.returnValue);
	    }
	}
    });

    clippy.addEventListener("click", () => {
	context.id = "";
	editPrompt.value = "";
	editDialog.showModal();
    });

    goBack.addEventListener("click", () => {
	if(codePos > 0) {
	    codePos--;
	    const safeCode = sanitizeCode(code[codePos]);
	    iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
	    iframe.contentDocument.body = safeCode.body;
	}
    });

    goForward.addEventListener("click", () => {
	if(codePos < code.length - 1) {
	    codePos++;
	    const safeCode = sanitizeCode(code[codePos]);
	    iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
	    iframe.contentDocument.body = safeCode.body;
	}
    });

    let stream = null;
    let mediaRecorder = null;
    let audioBlobs = [];

    window.addEventListener("keydown", async (evt) => {
	if(evt.key === "*" && mediaRecorder === null){
	    evt.stopPropagation();
	    hearing.style.visibility = "inherit";
	    if(setupDialog.open){
		setupDialog.close("$cancel");
	    }
	    if(editDialog.open){
		editDialog.close("$cancel");
	    }
	    stream = await navigator.mediaDevices.getUserMedia({audio: true});
	    mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
	    audioBlobs = [];

	    mediaRecorder.addEventListener("dataavailable", (evt) => {
		audioBlobs.push(evt.data);
	    });

	    mediaRecorder.start();
	    window.focus();
	}
    });

    window.addEventListener("keyup", async (evt) => {
	if(evt.key === "*"){
	    evt.stopPropagation();
	    hearing.style.visibility = "hidden";
            mediaRecorder.addEventListener("stop", async (evt) => {
		const audioBlob = new Blob(audioBlobs, {type: "audio/webm"});
		const formData = new FormData();
		formData.append("audio", audioBlob, "audio.webm");

		const request = await fetch("/whisper", {
		    method: "POST",
		    body: formData,
		});
		const transcript = await request.text();

		const div = document.createElement("div");
		div.className = "speech-bubble";
		div.textContent = transcript;
		document.body.appendChild(div);
		setTimeout(() => {
		    document.body.removeChild(div);
		}, 5000);

		if(context.id === ""){
		    if(codePos === -1){
			code.push(await requestCompletion("", transcript));
		    } else {
		        code.push(await requestCompletion(code[codePos], transcript));
		    }
		    codePos = code.length - 1;
		    const safeCode = sanitizeCode(code[codePos]);
		    iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
		    iframe.contentDocument.body = safeCode.body;
		    enableHistory();
		} else {
         	    await requestDiffCompletion(context.id, transcript);
		}
	    });
	    mediaRecorder.stop();
	    stream.getTracks().forEach(track => track.stop());
	    stream = null;
	    mediaRecorder = null;
	}
    });
}

window.addEventListener("load", async () => main());
