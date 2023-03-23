import os

import openai
import json
import itertools
import time
from flask import Flask, redirect, render_template, request, url_for

app = Flask(__name__)
openai.api_key = os.getenv("OPENAI_API_KEY")


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

@app.route("/", methods=[ "POST" ])
def index(): 
    params = json.loads(request.data)
    chat = load_chat()
    chat = chat + generate_next_chat_items(params)
    dump_chat(chat)

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=chat        
        )
    print("response: {}".format(response))

    result=response.choices[0].message.content

    return compose_response(result)

def generate_next_chat_items(params):
    next_id = params[ "next_id" ]
    next_class = params[ "next_class" ]
    next_prompt = params[ "next_prompt" ]
    next_tag = params[ "next_tag" ]

    if "previous_code" in params.keys():
        previous_code = params[ "previous_code" ]
        chat_items = [ 
            {"role": "assistant", "content": previous_code},
            {"role": "user", "content": "Do the following to the element with id {}: {}".format(next_id, next_prompt)} 
        ]
    else:
        chat_items = [ {"role": "user", "content": "Give me the html code for a web like this: {}".format(next_prompt)} ]
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
        print("chat file: {}".format(chat))
        return chat

def dump_chat(chat):
    with open(".chat.json", "w") as f:
        json.dump(chat, f, indent=4)

def generate_next_response(text):
    if text is None:
        return []

    clean_text = format_response(text)
    return [{"role": "assistant", "content": clean_text}]

def store_html_code(text):
    print("output: {}".format(text))
    if text is not None:
        clean_text = format_response(text)
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        filename = f"web_{timestamp}.html"

        with open(filename, "w") as f:
            f.write(clean_text)

def format_response(text):
    lines = text.splitlines()
    indexes = [i for i in range(len(lines)) if lines[i].startswith("```")]
    clean_text = "\n".join(lines[indexes[0]+1: indexes[1]])
    print("clean output: {}".format(clean_text))
    return clean_text
'''
Example prompt: A moving carousel of random images, one of them can be selected and is highlighted. Below a button says "set as wallpaper".
'''

x = """
sure, here it is:
```html
<html>
</html>
```
I hope you like it
"""
a = x.splitlines()
indexes = [i for i in range(len(a)) if a[i].startswith("```")]
cleanlines = a[indexes[0]+1: indexes[1]]
clean_text = "\n".join(cleanlines)
print(clean_text)
