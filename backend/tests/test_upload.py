import requests

url = "http://127.0.0.1:5000/documents"

# Replace the path below with your test file
files = {"file": open("sample.pdf", "rb")}

# Send POST request with file
response = requests.post(url, files=files)

# Print response JSON
print("Status code:", response.status_code)
print("Response text:", response.text)
