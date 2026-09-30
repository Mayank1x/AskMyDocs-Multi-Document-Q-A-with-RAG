# AskMyDocs (AI Document Summarizer)

A modern, production-ready RAG (Retrieval-Augmented Generation) web application that allows users to instantly chat with and analyze their documents. Built with a highly responsive React frontend and a robust Python/Flask backend.

## 🌟 Key Features

- **Zero-Login Multi-Tenancy**: Users can visit the app and instantly start uploading documents. The app assigns anonymous, persistent UUIDs stored in local storage, automatically isolating every user's documents and chat history entirely on the backend without forcing them to create an account.
- **Smart RAG Pipeline**: Uses a hybrid search approach (FAISS for dense vectors + BM25 for keyword search) over local HuggingFace embeddings (`all-MiniLM-L6-v2`) to achieve highly accurate document retrieval.
- **Resilient AI Generation**: Integrates with Google's latest Gemini API models (`gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.0-flash`). Features a robust automatic retry and fallback mechanism that catches `503 High Demand` or Rate Limit errors and gracefully switches models or delays and retries without breaking the user experience.
- **Real-time SSE Streaming**: AI answers stream back to the UI token-by-token. If an error occurs mid-stream, it is caught and appended to the UI cleanly.
- **Precise Source Attribution**: The AI provides exact snippets of the paragraphs it used to formulate its answer. Users can click on source cards to view the fully extracted text in a dedicated Preview Panel.
- **Multi-Format Uploads**: Supports PDF, DOCX, PPTX, CSV, Excel, TXT, and Images. Runs background ingestion threads for fast processing without locking the UI.

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Frontend [Frontend (React + Vite + Tailwind)]
        UI[User Interface]
        API_Service[API Interceptor]
        LocalStore[(Browser Local Storage)]
    end

    subgraph Backend [Backend (Python + Flask)]
        Router[Flask API Routes]
        MultiTenant[Multi-Tenancy Middleware]
        Ingestion[Background Ingestion Task]
        RAG[RAG Chain & Fallback Loop]
        
        subgraph Storage [Persistent Storage]
            PG[(PostgreSQL DB)]
            FAISS[(FAISS Vector Stores)]
            Docs[(Uploaded Files)]
        end
    end
    
    subgraph External [External APIs]
        Gemini[Google Gemini API]
        Embeddings[HuggingFace Embeddings]
    end

    UI <-->|SSE Stream & REST| API_Service
    LocalStore -.->|Auto-injects X-User-Id| API_Service
    
    API_Service <-->|HTTP Requests| Router
    Router --> MultiTenant
    MultiTenant -->|Isolates by User ID| Ingestion
    MultiTenant -->|Isolates by User ID| RAG
    
    Ingestion -->|1. Parse & Chunk| Docs
    Ingestion -->|2. Embed| Embeddings
    Ingestion -->|3. Store Vectors| FAISS
    Ingestion -->|4. Save Meta| PG
    
    RAG -->|1. Hybrid Search| FAISS
    RAG -->|2. Search Meta| PG
    RAG -->|3. Prompt & Context| Gemini
    Gemini -->|Streamed Response| RAG
```

## 🛠️ Tech Stack

### Frontend
- **React 19** (Vite)
- **Tailwind CSS** (for styling, fully responsive across Mobile, Tablet, Desktop)
- **Lucide React** (icons)
- **Axios** (with interceptors for UUID attachment)

### Backend
- **Python 3.9+** & **Flask** (API & SSE streams)
- **LangChain** (Document loading, chunking, and orchestration)
- **FAISS** (Local vector database for fast similarity search)
- **PostgreSQL** (Database for file metadata and user sessions)
- **Google GenAI SDK** (Gemini 3.x models)
- **Sentence-Transformers** (Local HuggingFace embeddings)

## 🚀 Setup & Deployment

### 1. Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL database running locally (or via Supabase)

### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder:
```env
DB_NAME=askmydocs
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432
GEMINI_API_KEY=your_gemini_api_key
```

Run the server:
```bash
python main.py
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5173` in your browser.

## ⚠️ Notes for Production Deployment
If you intend to host this application publicly (e.g., on Render, Railway, or AWS):
1. **Persistent Storage is Mandatory**: The backend saves physical files to `backend/data/uploads/` and FAISS vector indices to `backend/data/indexes/`. If you host this on a free tier with "ephemeral storage" (where the disk wipes itself when the server sleeps), users will lose their uploaded documents! Use a VPS (DigitalOcean/Oracle) or a persistent volume.
2. **Update API URLs**: Before deploying the frontend to Vercel/Netlify, remember to change the `BASE_URL` in `frontend/src/services/api.js` from `http://127.0.0.1:5000` to your live backend URL.