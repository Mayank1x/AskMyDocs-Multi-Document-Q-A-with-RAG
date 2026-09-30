import requests

url = "http://127.0.0.1:5000/chat-all"
data = {
    "question": "What are the key features of the uploaded documents?"
}

response = requests.post(url, json=data)
print(response.json())
