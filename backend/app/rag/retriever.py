import os
from typing import List, Optional
from langchain_core.documents import Document
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever
from app.config import config
from app.rag.vectorstore import load_user_index

# Global memory cache for BM25 retrievers per user
# Keys: user_id (str), Values: BM25Retriever
bm25_cache = {}

# Lazy load reranker
_reranker_model = None

def get_reranker():
    global _reranker_model
    if _reranker_model is None:
        from sentence_transformers import CrossEncoder
        _reranker_model = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)
    return _reranker_model

def build_bm25_from_vectorstore(vectorstore, user_id: str):
    """Extracts all documents from the vectorstore and builds the BM25 retriever."""
    if not vectorstore:
        bm25_cache.pop(user_id, None)
        return
        
    docs = list(vectorstore.docstore._dict.values())
    if not docs:
        bm25_cache.pop(user_id, None)
        return
        
    bm25 = BM25Retriever.from_documents(docs)
    bm25.k = config.RETRIEVAL_K
    bm25_cache[user_id] = bm25

def rebuild_bm25_cache(user_id: str):
    """Forces a rebuild of the BM25 cache for a user by loading all their documents."""
    vectorstore = load_user_index(user_id, document_ids=None)
    build_bm25_from_vectorstore(vectorstore, user_id)

def get_hybrid_retriever(user_id: str, document_ids: Optional[List[int]] = None):
    """
    Returns an EnsembleRetriever (FAISS + BM25) scoped to the user and optional document_ids.
    """
    vectorstore = load_user_index(user_id, document_ids)
    
    if not vectorstore:
        return None
        
    faiss_retriever = vectorstore.as_retriever(search_kwargs={"k": config.RETRIEVAL_K})
    
    if config.VECTOR_ONLY:
        return faiss_retriever
        
    # If a specific subset of docs is requested, we should dynamically build a subset BM25
    # to maintain strict scoring scope, or just use the global one and filter post-retrieval.
    # The safest way is to build a temporary one for this exact query scope.
    if document_ids is not None:
        subset_docs = list(vectorstore.docstore._dict.values())
        if not subset_docs:
            return faiss_retriever
        bm25_retriever = BM25Retriever.from_documents(subset_docs)
        bm25_retriever.k = config.RETRIEVAL_K
    else:
        # Use cached global BM25 for the user
        if user_id not in bm25_cache:
            build_bm25_from_vectorstore(vectorstore, user_id)
        bm25_retriever = bm25_cache.get(user_id)
        
        if not bm25_retriever:
             return faiss_retriever
             
    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, faiss_retriever],
        weights=[config.BM25_WEIGHT, config.VECTOR_WEIGHT]
    )
    return ensemble_retriever

def retrieve_and_rerank(query: str, user_id: str, document_ids: Optional[List[int]] = None) -> List[Document]:
    retriever = get_hybrid_retriever(user_id, document_ids)
    if not retriever:
        return []
        
    # Get initial top-K from the hybrid retriever
    # The ensemble retriever fetches more behind the scenes to balance weights
    docs = retriever.invoke(query)
    
    # Optional Cross-Encoder Reranking
    if config.RERANKER and docs:
        reranker = get_reranker()
        pairs = [[query, doc.page_content] for doc in docs]
        scores = reranker.predict(pairs)
        
        # Zip, sort by score descending
        doc_score_pairs = list(zip(docs, scores))
        doc_score_pairs.sort(key=lambda x: x[1], reverse=True)
        
        # Take the top K again
        docs = [doc for doc, score in doc_score_pairs][:config.RETRIEVAL_K]
    else:
        docs = docs[:config.RETRIEVAL_K]
        
    return docs
