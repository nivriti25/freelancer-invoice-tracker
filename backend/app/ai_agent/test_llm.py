import os
from dotenv import load_dotenv
from google import genai

# Load variables from backend/.env into the environment
load_dotenv()

# Create a client, this object handles the connection to Google's servers
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Send one message and get one response using a Chat session (recommended to avoid AFC warnings)
chat = client.chats.create(model="gemini-3.6-flash")
response = chat.send_message("In one sentence, explain what an overdue invoice is.")

print(response.text)

