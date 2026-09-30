# Current State of the Project

## Folder Map

```text
backend/
  app.py                 # Core Flask backend (routes, RAG logic, summarization)
  check_db.py            # Utility to inspect database
  ingest.py              # CLI utility to ingest files
  init_db.py             # DB schema creation script
  requirements.txt       # Python dependencies
  test_gemini.py         # Gemini API tester
  .env                   # Secrets
  indexes/               # FAISS index files (.index and .pkl)
  uploads/               # Uploaded files
  tests/                 # Backend tests

frontend/
  package.json           # Node dependencies
  src/
    App.jsx / main.jsx   # React entry points
    index.css            # Tailwind + Custom CSS
    pages/
      Home.jsx           # Main page orchestrating the layout
    components/
      Layout.jsx         # App shell (navbar, footer)
      FileUpload.jsx     # Drag-and-drop file uploader
      DocumentGrid.jsx   # Grid rendering the uploaded files
      FileCard.jsx       # Individual file display with action buttons
      ChatWithAI.jsx     # RAG conversational interface
      Loader.jsx         # Loading spinner
    services/
      api.js             # Axios API calls
```

## How a Request Flows Today

1. **Upload & Summarize**: A file is uploaded to `POST /summarize`. It is saved to disk.
2. **Text Extraction**: PyPDF2 (for PDFs) or python-docx (for DOCX) extracts the text. If PyPDF2 returns empty (e.g., scanned PDF), the raw file is sent to Gemini Multimodal for OCR.
3. **Summarization**: The text is summarized by Gemini. For files under 1M characters, it uses a single call. (Previously it used a chunked map-reduce approach).
4. **Database Store**: The filename, raw content, and summary are saved to PostgreSQL (`documents` table).
5. **Embedding & Store**: The text is chunked by word count (`chunk_text`). Chunks are embedded using `SentenceTransformer("all-MiniLM-L6-v2")`. The embeddings are stored in FAISS (saved to disk as `.index` and `.pkl`).
6. **Chat (Ask)**: A question is sent to `POST /chat/<id>`. The query is embedded, FAISS returns the top-K chunks, and Gemini generates an answer based on those chunks.

## Database Tables

Currently, there is one main PostgreSQL table:
- **`documents`**: `id` (SERIAL), `filename` (VARCHAR), `content` (TEXT), `summary` (TEXT), `uploaded_at` (TIMESTAMP).

## Libraries Used
- **OCR Library**: Gemini 3.5 Flash Multimodal OCR (via `google-genai`), previously `pytesseract` / `pdf2image` (removed).
- **PDF Library**: `PyPDF2`.
- **Word/Doc Library**: `python-docx`.

## Frontend Screens
- **Home**: The single page combining upload, file management, and chat.
  - **FileUpload**: A drag-and-drop zone.
  - **DocumentGrid/FileCard**: Lists files, shows their summary, and allows deletion/selection.
  - **ChatWithAI**: An interface to ask questions against a specific selected document or all documents.

## What to Keep
- The PostgreSQL database (we will expand tables).
- The general frontend styling (React, Tailwind), `Layout`, `ChatWithAI` UI, `FileUpload` component structure.
- Python virtual environment approach and Flask base.
- FAISS as the vector store concept (but upgrading to LangChain FAISS).
- `SentenceTransformer` for local CPU embeddings.

## What to Delete
- All summarization logic (`/summarize` route, `summarize_document_with_chunks`, summary database column, summary UI in frontend).
- Manual FAISS `.index` and `.pkl` saving/loading logic.
- Basic word-based chunker.
- Old PyPDF2 and custom OCR fallback (replacing with LangChain document loaders).
- Any mentions of the old project name; transitioning fully to **AskMyDocs**.
