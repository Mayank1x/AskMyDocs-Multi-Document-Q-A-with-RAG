import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # App
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "data", "uploads")
    INDEX_FOLDER = os.path.join(os.getcwd(), "data", "indexes")
    
    # DB
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "5432")
    
    # AI Limits
    MAX_FILE_SIZE_MB = 20
    MAX_PAGES = 300
    
    # Chunking
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 150
    
    # Embeddings
    EMBED_BATCH_SIZE = 100
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    
    # Vision & OCR
    IMAGE_CAPTIONING = os.getenv("IMAGE_CAPTIONING", "off").lower() == "on"
    OCR_TEXT_THRESHOLD = 50 # characters
    # Retrieval
    RETRIEVAL_K = 5
    VECTOR_ONLY = False
    BM25_WEIGHT = 0.3
    VECTOR_WEIGHT = 0.7
    RERANKER = os.getenv("RERANKER", "off").lower() == "on"

config = Config()
