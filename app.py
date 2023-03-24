import os

import openai
import json
import itertools
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

@app.route("/restart", methods=[ "POST" ])
def restart(): 
    restart_chat()
    return "OK"

@app.route("/dryrun", methods=[ "POST" ])
def dryrun(): 
    params = json.loads(request.data)
    chat = load_chat()
    chat = chat + generate_next_chat_items(params)
    dump_chat(chat)
    result="This is the code: \n```html\n<html>new</html>\n```I hope you like it"

    return compose_response(result) 

def compose_response(code):
    return json.dumps({"new_code": format_response(code)})

def compose_response_div(code):
    return json.dumps({"new_diff": format_response(code)})

@app.route("/diff", methods=[ "POST" ])
def div(): 
    params = json.loads(request.data)
    chat = generate_div_items(params)
    print ("diff chat: {}".format(chat))
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=chat        
        )
    print("diff response: {}".format(response))

    result=response.choices[0].message.content

    return compose_response_div(result)

def generate_div_items(params):
    diff = params[ "diff" ]
    next_prompt = params[ "next_prompt" ]

    chat_items = [ 
        {"role": "user", "content": "You are a web designer assistant that provides html code. The image urls in your code are always working images from https://picsum.photos, all different. I have an initial html element like this: \"{}\". Make the following modifications to it and return it as code: {}. Respect the style of the parentg".format(diff, next_prompt)} 
    ]
    return chat_items


@app.route("/", methods=[ "POST" ])
def index(): 
    params = json.loads(request.data)
    chat = load_chat()
    chat = chat + generate_next_chat_items(params)
    dump_chat(chat)

    print("chat items: {}".format(chat))

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=chat,
        temperature=0       
        )
    
    print("response: {}".format(response))

    result=response.choices[0].message.content

    return compose_response(result)

def generate_next_chat_items(params):
    next_prompt = params[ "next_prompt" ]

    if params["previous_code"] == "":
        chat_items = [ 
            {"role": "user", "content": "You are a web designer assistant that provides html code. The code you provide is always complete and functional. The image urls in your code are always working images from https://picsum.photos, all different. Give me the html code for a web like this: {}".format(next_prompt)} 
        ]
    else:
        previous_code = params[ "previous_code" ]
        chat_items = [ 
            {"role": "assistant", "content": "Here is the html code:\n```html\n{}\n```".format(previous_code)},
            {"role": "user", "content": "To the previous html code do the following change: {}. Return the full functional html code".format(next_prompt)} 
        ]
    return chat_items

def restart_chat():
    with open(".chat.json", "w") as f:
        json.dump([{
            "role": "system", 
            "content": "You are a web designer. Your webs always have ids in the tags"
        },], f, indent=4)

def load_chat():
    with open(".chat.json") as f:
        chat = json.load(f)
        return chat

def dump_chat(chat):
    with open(".chat.json", "w") as f:
        json.dump(chat, f, indent=4)

def generate_next_response(text):
    if text is None:
        return []

    clean_text = format_response(text)
    return [{"role": "assistant", "content": clean_text}]

def format_response(text):
    lines = text.splitlines()
    indexes = [i for i in range(len(lines)) if lines[i].startswith("```")]
    if len(indexes) == 0:
        indexes = [0, len(lines)]
    if len(indexes) == 1:
        indexes = indexes + len(lines)
    clean_text = "\n".join(lines[indexes[0]+1: indexes[1]])

    if not clean_text.strip().startswith("<"):
        index = clean_text.find("<")
        if index >= 0:
            clean_text = clean_text[index:len(clean_text)]

    return clean_text


x="""
hola
```html
fff
```
adios
"""
print(format_response(x))
x="""
hola
```html
fff2
```
"""
print(format_response(x))
x="""
```html
fff3
```
"""
print(format_response(x))
x="""
fff4
"""
print(format_response(x))
x="""
fff5\n\n<x>
"""
print(format_response(x))

print(generate_div_items({"diff": "<a>xx</a>", "next_prompt": "bigger" }))