import os
import json
import csv
import time
import requests
import re
from urllib.parse import urljoin

BASE_URL = "http://127.0.0.1:5000"
USER_ID = "eval_user"

def upload_and_wait():
    print("Uploading sample_policy.md...")
    file_path = os.path.join(os.path.dirname(__file__), "sample_policy.md")
    
    with open(file_path, 'rb') as f:
        res = requests.post(
            f"{BASE_URL}/api/documents",
            files={"files": f},
            headers={"X-User-Id": USER_ID}
        )
    
    if res.status_code != 200:
        raise Exception(f"Upload failed: {res.text}")
        
    data = res.json()
    if 'results' not in data or not data['results']:
        raise Exception("Upload failed, no results array")
        
    doc_id = data['results'][0].get('id')
    if not doc_id:
        print("File already uploaded or skipped. Fetching doc id...")
        docs = requests.get(f"{BASE_URL}/api/documents", headers={"X-User-Id": USER_ID}).json()
        doc_id = docs[0]['id']
        
    # Poll until ready
    print(f"Waiting for document {doc_id} to process...")
    while True:
        docs = requests.get(f"{BASE_URL}/api/documents", headers={"X-User-Id": USER_ID}).json()
        doc = next((d for d in docs if d['id'] == doc_id), None)
        if not doc:
            raise Exception("Document not found after upload")
            
        if doc['status'] == 'ready':
            print("Document is ready!")
            break
        elif doc['status'] == 'failed':
            raise Exception("Document processing failed")
            
        time.sleep(1)
        
    return doc_id

def ask_question(doc_id, question):
    res = requests.post(
        f"{BASE_URL}/api/chat",
        json={"question": question, "document_ids": [doc_id]},
        headers={"X-User-Id": USER_ID},
        stream=True
    )
    
    full_answer = ""
    for line in res.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    full_answer += data.get("text", "")
                except:
                    pass
    return full_answer.strip()

def run_eval():
    doc_id = upload_and_wait()
    
    dataset_path = os.path.join(os.path.dirname(__file__), "dataset.json")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)
        
    results = []
    correct = 0
    
    print("Starting evaluation loop...")
    for idx, item in enumerate(dataset):
        q = item["question"]
        expected = item["expected_keywords"]
        
        print(f"Q{idx+1}: {q}")
        ans = ask_question(doc_id, q)
        
        # Simple exact match evaluation
        ans_lower = ans.lower()
        passed = any(kw.lower() in ans_lower for kw in expected)
        if passed:
            correct += 1
            print(" -> PASS")
        else:
            print(" -> FAIL")
            
        results.append({
            "Question": q,
            "Expected Keywords": ", ".join(expected),
            "Actual Answer": ans,
            "Passed": passed
        })
        
        # Be nice to the API limits
        time.sleep(2)
        
    print(f"\nEvaluation Complete! Score: {correct}/{len(dataset)} ({(correct/len(dataset))*100:.1f}%)")
    
    # Save to CSV
    csv_path = os.path.join(os.path.dirname(__file__), "results.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Question", "Expected Keywords", "Actual Answer", "Passed"])
        writer.writeheader()
        writer.writerows(results)
    
    print(f"Results saved to {csv_path}")

if __name__ == "__main__":
    run_eval()
