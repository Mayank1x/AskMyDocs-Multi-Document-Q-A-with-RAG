import traceback
from concurrent.futures import ThreadPoolExecutor
from app.models import update_document_status
from app.rag.loaders import route_loader
from app.rag.chunking import chunk_documents
from app.rag.vectorstore import save_document_index
from app.rag.retriever import rebuild_bm25_cache

# A simple background thread pool
executor = ThreadPoolExecutor(max_workers=3)

def ingest_document_background(doc_id: int, filepath: str, user_id: str):
    """
    Background job to load, chunk, and embed a document.
    """
    try:
        update_document_status(doc_id, "processing")
        
        # 1. Load (This handles OCR and file parsing)
        docs = route_loader(filepath, doc_id, user_id)
        pages_count = len(set([d.metadata.get("page", 1) for d in docs]))
        
        # 2. Chunking
        chunks = chunk_documents(docs)
        
        # 3. Embedding / Vectorstore save
        save_document_index(user_id, doc_id, chunks)
        
        # 4. Rebuild in-memory BM25 Cache
        rebuild_bm25_cache(user_id)
        
        # 5. Done
        update_document_status(doc_id, "ready", pages_count=pages_count, chunks_count=len(chunks))
        
    except Exception as e:
        error_msg = f"Ingestion failed: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        # Use a user-friendly error message unless it's a known plain message
        safe_msg = "An error occurred while processing the file. Please try again."
        if "timeout" in str(e).lower() or "limit" in str(e).lower() or "quota" in str(e).lower():
            safe_msg = "The answer service is busy, try again in a minute."
        update_document_status(doc_id, "failed", error_message=safe_msg)

def start_ingestion(doc_id: int, filepath: str, user_id: str):
    executor.submit(ingest_document_background, doc_id, filepath, user_id)
