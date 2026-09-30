# Architecture Decisions

## Phase 1: Rename and Remove Summarizer
- **Decision:** Removed all summarizer endpoints (`/summarize`), frontend UI buttons, summary database columns, and renamed the project from DocuMind to AskMyDocs.
- **Why:** To follow the spec for Phase 1. The focus is now purely on building a solid RAG architecture, rather than storing massive summaries upfront.

## Phase 2: Ingestion
- **Decision:** Used `pypdf` for text and image extraction from PDFs instead of adding new heavy dependencies.
- **Decision:** For OCR, we use Gemini 3.5 Flash via `google-genai` directly. We pass image bytes without saving to disk. A retry decorator handles rate limits.
- **Decision:** Chunking relies on `langchain_text_splitters`. Markdown is chunked by headers first, then recursively. CSV/XLSX are chunked row-by-row logicly without mid-row splitting.
- **Decision:** Embeddings are local using Hugging Face `all-MiniLM-L6-v2`. This is free and fast. We batch the embedding process.
- **Decision:** For FAISS, to satisfy the delete requirement cleanly, we store one FAISS index per document (e.g. `indexes/{user_id}/{doc_id}/`). At query time, we load all requested document indexes and merge them in-memory using `FAISS.merge_from`. This avoids complicated `remove_ids` logic and provides perfect isolation. Since we wrote the FAISS files, we use `allow_dangerous_deserialization=True` to load them.
- **Decision:** Re-architected `app.py` into `main.py` and modularized `app/rag/loaders.py`, `app/rag/vectorstore.py`, `app/rag/retriever.py`, etc., to make the codebase interview-ready.

## Phase 4 & 5: Hybrid Retrieval & Chat Chain
- **Decision:** Built a custom EnsembleRetriever combining FAISS (vector search) and BM25 (keyword search). The BM25 index is built in-memory on demand from the `docstore` inside the requested FAISS indexes, saving us from persisting it separately.
- **Decision:** Cross-encoder reranking is implemented using `ms-marco-MiniLM-L-6-v2` locally to improve precision before hitting the LLM context window.
- **Decision:** The chat endpoint uses Server-Sent Events (SSE) via `yield` in Flask to stream the Gemini response chunk-by-chunk to the UI.

## Phase 6: Frontend Refactor
- **Decision:** Switched from a two-page drill-down UI to a side-by-side Dashboard. The left side handles multi-file dragging/dropping and file selection. The right side is a sticky global chat window.
- **Decision:** Replaced `axios` with standard `fetch` in the chat client in order to stream Server-Sent Events using `response.body.getReader()`.
- **Decision:** The frontend automatically polls the backend every 2 seconds when any file is `queued` or `processing`. It gracefully reflects the `page X of Y` status sent by the backend.

## Phase 7: Evaluation
- **Decision:** Created an `eval.py` script that hits the real API endpoints and measures Exact Match retrieval/accuracy against a dummy company policy dataset (`dataset.json`). This ensures the end-to-end RAG architecture works in real scenarios. Output is saved to `results.csv`.

## Phase 8 & 9: Testing & Documentation
- **Decision:** Used `pytest` with `pytest-mock` to completely isolate the backend. This means the tests mock out the database, LLM API calls, and background ingestion threads, making them lightning fast and free to run in CI.
- **Decision:** Added a GitHub Actions workflow `.github/workflows/python-app.yml` to run these Pytest checks automatically on Pull Requests.
- **Decision:** Re-wrote the README to be perfectly tailored for a recruiter or technical interviewer, featuring clear setup instructions, feature descriptions, and a direct link to this Decisions document.
