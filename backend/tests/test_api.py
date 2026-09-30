import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json == {"status": "ok"}

@patch('app.rag.ingestion.start_ingestion')
def test_upload_documents(mock_start, client):
    import io
    data = {
        'files': (io.BytesIO(b"test content"), "test.txt")
    }
    response = client.post(
        '/api/documents', 
        data=data,
        content_type='multipart/form-data',
        headers={"X-User-Id": "test_user"}
    )
    assert response.status_code == 200
    assert "results" in response.json
    res = response.json["results"][0]
    assert res["filename"] == "test.txt"
    assert res["status"] in ["queued", "skipped"]

@patch('main.delete_document_index')
@patch('main.rebuild_bm25_cache')
@patch('main.get_document')
def test_delete_document(mock_get_doc, mock_rebuild, mock_delete, client):
    mock_get_doc.return_value = {"id": 1, "filename": "test.txt", "file_hash": "hash123"}
    response = client.delete(
        '/api/documents/1',
        headers={"X-User-Id": "test_user"}
    )
    assert response.status_code == 200
    assert response.json == {"message": "Deleted successfully"}
    mock_delete.assert_called_once()
    mock_rebuild.assert_called_once()

@patch('app.rag.chain.retrieve_and_rerank')
@patch('google.genai.Client')
def test_chat(mock_client_class, mock_retrieve, client):
    # Mock retriever
    from langchain_core.documents import Document
    mock_retrieve.return_value = [Document(page_content="Mock content", metadata={"filename": "test.txt", "page": 1})]
    
    # Mock Gemini Stream
    mock_client = MagicMock()
    mock_stream = MagicMock()
    
    class MockChunk:
        def __init__(self, text):
            self.text = text
            
    mock_stream.__iter__.return_value = [MockChunk("Hello "), MockChunk("World")]
    mock_client.models.generate_content_stream.return_value = mock_stream
    mock_client_class.return_value = mock_client
    
    response = client.post(
        '/api/chat',
        json={"question": "Test question"},
        headers={"X-User-Id": "test_user"}
    )
    
    assert response.status_code == 200
    text_data = response.data.decode('utf-8')
    assert "data: " in text_data
    assert "Hello " in text_data
    assert "World" in text_data
    assert "test.txt" in text_data
