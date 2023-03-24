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

let code = "";

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
    code = iframe.contentDocument.documentElement.outerHTML;
}

function eventizeDOM(dom) {
    if(dom.children.length == 0){
	dom.id = uuidv4();
	dom.addEventListener("click", (evt) => {
    	    evt.stopPropagation();
	    editPrompt.value = "";
	    editDialog.showModal();
	    context.id = evt.target.id;
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
	if(setupDialog.returnValue === "$audio") {
	    //await recordAudioAndRequestCompletion();
	} else {
	    code = await requestCompletion(code, setupDialog.returnValue);
	    const safeCode = sanitizeCode(code);
	    iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
	    iframe.contentDocument.body = safeCode.body;
	}
    });

    editPrompt.addEventListener("change", () => {
	editConfirm.value = editPrompt.value;
    });

    editDialog.addEventListener("close", async () => {
	if(editDialog.returnValue !== "$cancel"){
	    if(context.id === ""){
	        code = await requestCompletion(code, editDialog.returnValue);
	        const safeCode = sanitizeCode(code);
	        console.log(safeCode);
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

    let stream = null;
    let mediaRecorder = null;
    let audioBlobs = [];

    window.addEventListener("keydown", async (evt) => {
	if(evt.key === " " && mediaRecorder === null){
	    hearing.style.visibility = "inherit";
	    if(setupDialog.open){
		setupDialog.close("$audio");
	    }
	    stream = await navigator.mediaDevices.getUserMedia({audio: true});
	    mediaRecorder = new MediaRecorder(stream, {mimeType: "audio/webm"});
	    audioBlobs = [];

	    mediaRecorder.addEventListener("dataavailable", (evt) => {
		audioBlobs.push(evt.data);
	    });

	    mediaRecorder.start();
	}
    });

    window.addEventListener("keyup", async (evt) => {
	if(evt.key === " " && mediaRecorder !== null){
	    hearing.style.visibility = "hidden";
            mediaRecorder.addEventListener("stop", async (evt) => {
		const audioBlob = new Blob(audioBlobs, {type: "audio/webm"});
		console.log(URL.createObjectURL(audioBlob));
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

		code = await requestCompletion(code, transcript);
		const safeCode = sanitizeCode(code);
		iframe.contentDocument.head.innerHTML = safeCode.head.innerHTML;
		iframe.contentDocument.body = safeCode.body;
	    });
	    mediaRecorder.stop();
	    stream.getTracks().forEach(track => track.stop());
	    stream = null;
	    mediaRecorder = null;
	}
    });
}

window.addEventListener("load", async () => main());
