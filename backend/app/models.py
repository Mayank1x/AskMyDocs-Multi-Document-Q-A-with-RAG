import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import config
import hashlib

def get_db_connection():
    return psycopg2.connect(
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        host=config.DB_HOST,
        port=config.DB_PORT
    )

def ensure_db_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # We add user_id, status, file_hash, error_message, chunks_count, pages_count
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(100) NOT NULL,
            filename VARCHAR(500) NOT NULL,
            file_hash VARCHAR(64) NOT NULL,
            status VARCHAR(50) DEFAULT 'queued',
            error_message TEXT,
            pages_count INTEGER DEFAULT 0,
            chunks_count INTEGER DEFAULT 0,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Indexes for faster lookups
        CREATE INDEX IF NOT EXISTS idx_docs_user_id ON documents(user_id);
        CREATE INDEX IF NOT EXISTS idx_docs_hash ON documents(file_hash);
    """)
    conn.commit()
    cur.close()
    conn.close()

def hash_file(file_path: str) -> str:
    """Returns SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def get_document(doc_id: int, user_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM documents WHERE id = %s AND user_id = %s;", (doc_id, user_id))
    doc = cur.fetchone()
    cur.close()
    conn.close()
    return doc

def get_documents_by_user(user_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM documents WHERE user_id = %s ORDER BY uploaded_at DESC;", (user_id,))
    docs = cur.fetchall()
    cur.close()
    conn.close()
    return docs

def update_document_status(doc_id: int, status: str, error_message: str = None, pages_count: int = 0, chunks_count: int = 0):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE documents 
        SET status = %s, error_message = %s, pages_count = %s, chunks_count = %s
        WHERE id = %s;
    """, (status, error_message, pages_count, chunks_count, doc_id))
    conn.commit()
    cur.close()
    conn.close()
