import os

import openai
import time
from flask import Flask, redirect, render_template, request, url_for, send_from_directory
from werkzeug.utils import secure_filename
import ffmpeg
import uuid

app = Flask(__name__)
openai.api_key = os.getenv("OPENAI_API_KEY")

@app.route("/webgpt/<path:path>", methods=["GET"])
def webgpt_index(path):
    return send_from_directory("front", path)

@app.route("/whisper", methods=["POST"])
def whisper():
    file = request.files["audio"]
    filename = secure_filename(file.filename)
    file.save(filename)
    file.stream.seek(0)
    file.close()
    outfile = f"audio-{uuid.uuid4()}.mp3"
    ffmpeg.input(filename).output(outfile).run()
    file = open(outfile, "rb")
    transcript = openai.Audio.transcribe("whisper-1", file)
    print(transcript)
    return transcript["text"]

@app.route("/", methods=("GET", "POST"))
def index(): 
    print("call. key: {}".format(openai.api_key))
    if request.method == "POST":
        animal = request.form["animal"]
        prompt = generate_prompt(animal)
        print("Prompt: {}".format(prompt))
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
             messages=[
                {"role": "system", "content": "You are a web designer. Your webs always have ids in the tags"},
                {"role": "user", "content": prompt},
            ]
        )
        print("response: {}".format(response))
        return redirect(url_for("index", result=response.choices[0].message.content))

    result = request.args.get("result")
    next_prompt = request.args.get("next_prompt")
    next_id = request.args.get("next_id")
    next_class = request.args.get("next_class")
    next_tag = request.args.get("next_tag")

    store_html_code(result)

    return render_template("index.html", result=result)

def store_html_code(text):
    print("output: {}".format(text))
    if text is not None:
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = f"web_{timestamp}.html"

        with open(filename, "w") as f:
            f.write(text)

'''
Example prompt: A moving carousel of random images, one of them can be selected and is highlighted. Below a button says "set as wallpaper".
'''
def generate_prompt(animal):
    return """Create html with embedded javascript code for the following web page: {}.""".format(animal)
