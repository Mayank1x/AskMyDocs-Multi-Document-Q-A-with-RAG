import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
# Prevent PyTorch/OpenMP deadlock in ThreadPoolExecutor on Windows
os.environ['OMP_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['USE_TF'] = '0'
os.environ['USE_TORCH'] = '1'
import uuid
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from app.config import config
from app.models import ensure_db_schema, get_db_connection, hash_file, update_document_status, get_document, get_documents_by_user
from app.rag.ingestion import start_ingestion
from app.rag.vectorstore import delete_document_index
from app.rag.retriever import rebuild_bm25_cache
from app.rag.chain import chat_with_docs # We will implement this next

app = Flask(__name__)
CORS(app)

# --- Middleware: User Isolation ---
@app.before_request
def get_user():
    # Keep auth simple: per-browser user_id via header, query param, or a generic fallback
    request.user_id = request.headers.get("X-User-Id") or request.args.get("user_id") or "default_user"

# --- Startup ---
os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(config.INDEX_FOLDER, exist_ok=True)
ensure_db_schema()

# Fix any documents stuck in processing from a previous crash
conn = get_db_connection()
cur = conn.cursor()
cur.execute("""
    UPDATE documents 
    SET status = 'failed', error_message = 'Processing interrupted by server restart. Please delete and re-upload.' 
    WHERE status NOT IN ('ready', 'failed', 'queued')
""")
if cur.rowcount > 0:
    print(f"[Startup] Fixed {cur.rowcount} documents stuck in processing state")
conn.commit()
cur.close()
conn.close()

# --- Endpoints ---

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/api/documents", methods=["POST"])
def upload_documents():
    if "files" not in request.files and "file" not in request.files:
        return jsonify({"error": "No files provided"}), 400
        
    files = request.files.getlist("files")
    if not files:
        files = request.files.getlist("file") # Fallback for frontend compatibility
        
    if len(files) > 10:
        return jsonify({"error": "Max 10 files allowed"}), 400
        
    user_id = request.user_id
    user_upload_dir = os.path.join(config.UPLOAD_FOLDER, user_id)
    os.makedirs(user_upload_dir, exist_ok=True)
    
    results = []
    
    for file in files:
        if file.filename == "":
            continue
            
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        
        if size > config.MAX_FILE_SIZE_MB * 1024 * 1024:
            results.append({"filename": file.filename, "status": "failed", "error_message": f"File exceeds {config.MAX_FILE_SIZE_MB}MB limit"})
            continue
            
        ext = file.filename.split('.')[-1].lower()
        if ext not in ["pdf", "docx", "pptx", "csv", "xlsx", "txt", "md", "html", "png", "jpg", "jpeg", "webp"]:
            results.append({"filename": file.filename, "status": "failed", "error_message": "Unsupported file type"})
            continue
            
        # Save temp to hash
        temp_path = os.path.join(user_upload_dir, f"temp_{uuid.uuid4()}_{file.filename}")
        file.save(temp_path)
        file_hash = hash_file(temp_path)
        
        # Check if hash already exists for user
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM documents WHERE user_id = %s AND file_hash = %s", (user_id, file_hash))
        existing = cur.fetchone()
        
        if existing:
            os.remove(temp_path)
            results.append({"filename": file.filename, "status": "skipped", "error_message": "File already uploaded"})
            cur.close()
            conn.close()
            continue
            
        # Save real
        filepath = os.path.join(user_upload_dir, f"{file_hash}_{file.filename}")
        os.rename(temp_path, filepath)
        
        cur.execute(
            "INSERT INTO documents (user_id, filename, file_hash, status) VALUES (%s, %s, %s, %s) RETURNING id;",
            (user_id, file.filename, file_hash, "queued")
        )
        doc_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        # Trigger background
        start_ingestion(doc_id, filepath, user_id)
        
        results.append({"id": doc_id, "filename": file.filename, "status": "queued"})
        
    return jsonify({"results": results})

@app.route("/api/documents", methods=["GET"])
def list_documents():
    docs = get_documents_by_user(request.user_id)
    return jsonify(docs)

@app.route("/api/documents/<int:doc_id>/file", methods=["GET"])
def get_original_file(doc_id):
    from flask import send_file
    doc = get_document(doc_id, request.user_id)
    if not doc:
         return jsonify({"error": "Not found"}), 404
         
    user_upload_dir = os.path.join(config.UPLOAD_FOLDER, request.user_id)
    filepath = os.path.join(user_upload_dir, f"{doc['file_hash']}_{doc['filename']}")
    
    if not os.path.exists(filepath):
        return jsonify({"error": "File missing on disk"}), 404
        
    return send_file(filepath, as_attachment=False)

@app.route("/api/documents/<int:doc_id>", methods=["DELETE"])
def delete_document_route(doc_id):
    doc = get_document(doc_id, request.user_id)
    if not doc:
        return jsonify({"error": "Not found"}), 404
        
    # Delete from DB
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
    conn.commit()
    cur.close()
    conn.close()
    
    # Delete from disk
    user_upload_dir = os.path.join(config.UPLOAD_FOLDER, request.user_id)
    filepath = os.path.join(user_upload_dir, f"{doc['file_hash']}_{doc['filename']}")
    if os.path.exists(filepath):
        os.remove(filepath)
        
    # Delete from FAISS
    delete_document_index(request.user_id, doc_id)
    
    # Rebuild BM25 cache
    rebuild_bm25_cache(request.user_id)
    
    return jsonify({"message": "Deleted successfully"})

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    question = data.get("question", "")
    document_ids = data.get("document_ids", None)
    
    if not question:
        return jsonify({"error": "Question is required"}), 400
        
    return Response(chat_with_docs(question, request.user_id, document_ids), mimetype="text/event-stream")

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
