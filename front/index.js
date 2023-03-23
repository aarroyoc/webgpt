const setupDialog = document.getElementById("setup");
const setupPrompt = document.getElementById("setup-prompt");
const setupConfirm = document.getElementById("setup-confirm");
const editDialog = document.getElementById("edit");
const editPrompt = document.getElementById("edit-prompt");
const editConfirm = document.getElementById("edit-confirm");
const iframe = document.getElementById("iframe");
const clippy = document.getElementById("clippy");
const loadingSkely = document.getElementById("loading-skely");

let code = "";

const context = {
    "id": "",
    "className": "",
    "tag": "",
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


async function requestCompletion(code, next_prompt) {
    // return "<html><body><h2>HE<i>L</i>LO</h2></body></html>";
    const requestBody = {
	"previous_code": code,
	"next_prompt": next_prompt,
	"next_id": context.id,
	"next_class": context.className,
	"next_tag": context.tag,
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

function eventizeDOM(dom) {
    if(dom.children.length == 0){
	dom.id = uuidv4();
	dom.addEventListener("click", (evt) => {
    	    evt.stopPropagation();
	    editPrompt.value = "";
	    editDialog.showModal();
	    context.tag = evt.target.tagName;
	    context.id = evt.target.id;
	    context.className = evt.target.className;
	});
    } else {
	for(let children of dom.children) {
	    eventizeDOM(children);
	}
	dom.id = uuidv4();	
	dom.addEventListener("click", (evt) => {
	    evt.stopPropagation();
	    editPrompt.value = "";
	    editDialog.showModal();
	    context.tag = evt.target.tagName;
	    context.id = evt.target.id;
	    context.className = evt.target.className;
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
	if(setupDialog.returnValue === "$audio") {
	    await recordAudioAndRequestCompletion();
	} else {
	    code = await requestCompletion(code, setupDialog.returnValue);
	    const safeCode = sanitizeCode(code);
	    iframe.contentDocument.body = safeCode.body;
	}
    });

    editPrompt.addEventListener("change", () => {
	editConfirm.value = editPrompt.value;
    });

    editDialog.addEventListener("close", async () => {
	if(editDialog.returnValue !== "$cancel"){
	    code = await requestCompletion(code, editDialog.returnValue);
	    const safeCode = sanitizeCode(code);
	    iframe.contentDocument.body = safeCode.body;
	}
    });

    clippy.addEventListener("click", () => {
	context.id = "";
	context.tag = "";
	context.className = "";
	editPrompt.value = "";
	editDialog.showModal();
    });
}

async function recordAudioAndRequestCompletion() {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
    const audioBlobs = [];

    mediaRecorder.addEventListener("dataavailable", (evt) => {
	audioBlobs.push(evt.data);
    });

    mediaRecorder.start();

    setTimeout(() => {
	const mimeType = mediaRecorder.mimeType;

	mediaRecorder.addEventListener("stop", async (evt) => {
	    const audioBlob = new Blob(audioBlobs, {type: mimeType});
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
	    //setTimeout(() => {
	    //	 document.body.removeChild(div);
	    //}, 5000);
	    
	    code = await requestCompletion(code, transcript);
	    const safeCode = sanitizeCode(code);
	    iframe.contentDocument.body = safeCode.body;
	});
	mediaRecorder.stop();
	stream.getTracks().forEach(track => track.stop());
    }, 10000);
}

window.addEventListener("load", async () => main());
