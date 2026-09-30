import requests


url = "http://127.0.0.1:5000/chat/17"
data = {"question": "What is this document about?"}

response = requests.post(url, json=data)

print("Status:", response.status_code)
print("Response:", response.json())
