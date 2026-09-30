from langchain_text_splitters import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
from langchain_core.documents import Document
from app.config import config

def get_default_splitter():
    return RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        add_start_index=True
    )

def chunk_markdown(text: str, metadata: dict) -> list[Document]:
    """Split markdown by headers first, then by characters."""
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    md_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    md_header_splits = md_splitter.split_text(text)
    
    # Now split recursively for any long sections under a header
    chunker = get_default_splitter()
    final_chunks = chunker.split_documents(md_header_splits)
    
    # Inject original metadata
    for doc in final_chunks:
        doc.metadata.update(metadata)
        
    return final_chunks

def chunk_documents(documents: list[Document]) -> list[Document]:
    """
    Given a list of LangChain Documents (usually one per page or row),
    chunk them according to their content type.
    """
    final_chunks = []
    chunker = get_default_splitter()
    
    for doc in documents:
        content_type = doc.metadata.get("content_type", "text")
        
        if content_type == "table":
            # CSV/XLSX rows are already chunked logically during loading.
            # We don't want to split them mid-word or mid-sentence.
            final_chunks.append(doc)
            
        elif doc.metadata.get("source", "").endswith(".md") or content_type == "markdown":
            md_chunks = chunk_markdown(doc.page_content, doc.metadata)
            final_chunks.extend(md_chunks)
            
        else:
            # Default text / OCR / captions
            split_docs = chunker.split_documents([doc])
            final_chunks.extend(split_docs)
            
    # Add chunk_index metadata
    for i, chunk in enumerate(final_chunks):
        chunk.metadata["chunk_index"] = i
        
    return final_chunks
