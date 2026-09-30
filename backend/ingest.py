"""Rebuild FAISS indexes for all documents in the database."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import faiss
import numpy as np
import os
os.environ['PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION'] = 'python'
from sentence_transformers import SentenceTransformer
import pickle
from dotenv import load_dotenv

# ---------- Load env ----------
load_dotenv()

# ---------- Directories (aligned with app.py) ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INDEX_FOLDER = os.path.join(BASE_DIR, "indexes")
os.makedirs(INDEX_FOLDER, exist_ok=True)

# ---------- DB connection ----------
def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
    )

# ---------- Embedding model (same as app.py) ----------
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# ---------- Chunking (aligned with app.py: 500 words, 50 overlap) ----------
def chunk_text(text, chunk_size=500, overlap=50):
    """Split text into overlapping word-based chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks

# ---------- Rebuild all FAISS indexes ----------
def rebuild_all_indexes():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, content FROM documents;")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    print(f"Found {len(rows)} documents. Rebuilding FAISS indexes...")

    for row in rows:
        file_id = row["id"]
        content = row["content"] or ""
        chunks = chunk_text(content)
        if not chunks:
            print(f"  Document {file_id} has no text, skipping.")
            continue
        embeddings = embedder.encode(chunks, convert_to_numpy=True).astype("float32")
        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(embeddings)

        # Save using same format as app.py: {id}.index and {id}.pkl
        faiss.write_index(index, os.path.join(INDEX_FOLDER, f"{file_id}.index"))
        with open(os.path.join(INDEX_FOLDER, f"{file_id}.pkl"), "wb") as f:
            pickle.dump(chunks, f)

        print(f"  Built index for document {file_id} ({len(chunks)} chunks)")

    print("All indexes rebuilt successfully.")

if __name__ == "__main__":
    rebuild_all_indexes()
