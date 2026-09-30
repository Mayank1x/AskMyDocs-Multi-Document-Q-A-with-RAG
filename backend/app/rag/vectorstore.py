import os
import shutil
from typing import List, Optional
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from app.config import config

# We use CPU by default for the local HF model
embeddings = HuggingFaceEmbeddings(
    model_name=config.EMBEDDING_MODEL,
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)

def get_doc_index_path(user_id: str, doc_id: int) -> str:
    """Path to the specific document's FAISS index."""
    return os.path.join(config.INDEX_FOLDER, str(user_id), str(doc_id))

def save_document_index(user_id: str, doc_id: int, docs: List[Document]):
    """
    Embed and save chunks for a single document.
    We embed in batches to avoid high memory spikes.
    """
    path = get_doc_index_path(user_id, doc_id)
    os.makedirs(path, exist_ok=True)
    
    # Check for existing progress
    if os.path.exists(os.path.join(path, "index.faiss")):
        try:
            vectorstore = FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)
        except Exception:
            vectorstore = None
    else:
        vectorstore = None
        
    # Calculate how many docs are already embedded
    embedded_count = 0
    if vectorstore is not None:
        embedded_count = len(vectorstore.docstore._dict)
        
    if embedded_count >= len(docs):
        return # Already fully embedded
        
    docs_to_embed = docs[embedded_count:]
        
    # Batch embeddings
    for i in range(0, len(docs_to_embed), config.EMBED_BATCH_SIZE):
        batch = docs_to_embed[i:i + config.EMBED_BATCH_SIZE]
        if vectorstore is None:
            vectorstore = FAISS.from_documents(batch, embeddings)
        else:
            vectorstore.add_documents(batch)
            
        # Save progress after every batch
        vectorstore.save_local(path)

def load_user_index(user_id: str, document_ids: Optional[List[int]] = None) -> Optional[FAISS]:
    """
    Loads all requested document indexes for a user and merges them into one in-memory FAISS index.
    If document_ids is None, loads all documents for the user.
    """
    user_dir = os.path.join(config.INDEX_FOLDER, str(user_id))
    if not os.path.exists(user_dir):
        return None
        
    available_doc_ids = [d for d in os.listdir(user_dir) if os.path.isdir(os.path.join(user_dir, d))]
    
    if document_ids is not None:
        # Filter to only the requested ones
        doc_ids_str = [str(d) for d in document_ids]
        available_doc_ids = [d for d in available_doc_ids if d in doc_ids_str]
        
    if not available_doc_ids:
        return None
        
    combined_index = None
    for d_id in available_doc_ids:
        path = os.path.join(user_dir, d_id)
        # allow_dangerous_deserialization is safe because we solely generated these files locally.
        idx = FAISS.load_local(path, embeddings, allow_dangerous_deserialization=True)
        if combined_index is None:
            combined_index = idx
        else:
            combined_index.merge_from(idx)
            
    return combined_index

def delete_document_index(user_id: str, doc_id: int):
    """Deletes the FAISS index for a single document."""
    path = get_doc_index_path(user_id, doc_id)
    if os.path.exists(path):
        shutil.rmtree(path)
