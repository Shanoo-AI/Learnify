import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

models = genai.list_models()
for model in models:
    print(model["name"], "-", model.get("description", ""))
