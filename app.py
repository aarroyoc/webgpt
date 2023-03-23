import os

import openai
import json
import itertools
import time
from flask import Flask, redirect, render_template, request, url_for

app = Flask(__name__)
openai.api_key = os.getenv("OPENAI_API_KEY")


@app.route("/", methods=("GET", "POST"))
def index(): 
    if request.method == "POST":
        chat = load_chat()
        chat = chat + generate_next_chat_item(request)
        dump_chat(chat)

        animal = request.form["animal"]
        prompt = generate_prompt(animal)
        print("Prompt: {}".format(prompt))
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
             messages=chat        )
        print("response: {}".format(response))
        return redirect(url_for("index", result=response.choices[0].message.content))

    result = request.args.get("result")
    chat = load_chat() + generate_next_response(result)
    dump_chat(chat)

    store_html_code(result)

    return render_template("index.html", result=result)

def generate_next_chat_item(request):
    next_prompt = request.args.get("next_prompt")
    next_id = request.args.get("next_id")
    next_class = request.args.get("next_class")
    next_tag = request.args.get("next_tag")
    return [{"role": "user", "content": "Do the following to the element with id {next_id}: {prompt}"}]

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
    print("lines:::::")
    print(lines)
    lines = list(itertools.dropwhile(lambda line: not line.startswith("```"), lines))
    lines = list(itertools.filterfalse(lambda line: line.startswith("```"), lines))
    print(lines)
    print("lines:::::3")
    print(lines)
    clean_text = "\n".join(lines)
    print("clean output: {}".format(clean_text))
    return clean_text
'''
Example prompt: A moving carousel of random images, one of them can be selected and is highlighted. Below a button says "set as wallpaper".
'''
def generate_prompt(description):
    return """Create html code for the following web page: {}.""".format(description)

restart_chat()
x = load_chat()
x = x + [{"role":"user", "content": "y"}]
dump_chat(x)

x = load_chat()
y = generate_next_response("""
this is:
```html
<y>
```
""")
print (y) 
dump_chat (x + y)

