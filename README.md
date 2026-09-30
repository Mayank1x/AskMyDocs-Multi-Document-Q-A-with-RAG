# AskMyDocs (AI Document Summarizer)

A modern, production-ready Retrieval-Augmented Generation (RAG) web application that allows users to instantly chat with and analyze their documents. Built with a highly responsive React frontend and a robust Python and Flask backend.

## Key System Features

- **Zero-Login Multi-Tenancy**: Users can visit the application and instantly start uploading documents. The frontend assigns anonymous, persistent UUIDs stored in browser local storage. Every API request attaches this ID, isolating every user's documents, vector databases, and chat history entirely on the backend without forcing account creation.
- **Resilient AI Generation**: Integrates with Google's Gemini API models (gemini-3.8-flash, gemini-3.5-flash, gemini-3.0-flash). The backend features an automatic retry and fallback mechanism that catches 503 High Demand or Rate Limit errors and gracefully switches models or delays and retries without breaking the user experience.
- **Real-time SSE Streaming**: Answers stream back to the User Interface token-by-token using Server-Sent Events. Mid-stream errors are caught and appended to the chat interface cleanly.
- **Precise Source Attribution**: The AI provides exact snippets of the paragraphs it used to formulate its answer. Users can click on source cards to view the fully extracted text in a dedicated Preview Panel.
- **Multi-Format Background Uploads**: Supports PDF, DOCX, PPTX, CSV, Excel, TXT, and Images. Runs background ingestion threads for fast processing without locking the user interface.

## System Architecture

```mermaid
graph TD
    subgraph Frontend
        UI[User Interface]
        API_Service[API Interceptor]
        LocalStore[(Browser Local Storage)]
    end

    subgraph Backend
        Router[Flask API Routes]
        MultiTenant[Multi-Tenancy Middleware]
        Ingestion[Background Ingestion Task]
        RAG[RAG Chain and Fallback Loop]
        
        subgraph Storage
            PG[(PostgreSQL DB)]
            FAISS[(FAISS Vector Stores)]
            Docs[(Uploaded Files)]
        end
    end
    
    subgraph External
        Gemini[Google Gemini API]
        Embeddings[HuggingFace Embeddings]
    end

    UI <-->|SSE Stream and REST| API_Service
    LocalStore -.->|Auto-injects X-User-Id| API_Service
    
    API_Service <-->|HTTP Requests| Router
    Router --> MultiTenant
    MultiTenant -->|Isolates by User ID| Ingestion
    MultiTenant -->|Isolates by User ID| RAG
    
    Ingestion -->|1. Parse and Chunk| Docs
    Ingestion -->|2. Embed| Embeddings
    Ingestion -->|3. Store Vectors| FAISS
    Ingestion -->|4. Save Metadata| PG
    
    RAG -->|1. Hybrid Search| FAISS
    RAG -->|2. Search Meta| PG
    RAG -->|3. Prompt and Context| Gemini
    Gemini -->|Streamed Response| RAG
```

## Setup Instructions

### 1. Prerequisites
- Python 3.9 or higher
- Node.js 18 or higher
- PostgreSQL database running locally (or via a cloud provider like Supabase)

### 2. Backend Setup
Navigate to the backend directory and set up a virtual environment:
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Mac or Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend` folder containing your credentials:
```env
DB_NAME=askmydocs
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=127.0.0.1
DB_PORT=5432
GEMINI_API_KEY=your_gemini_api_key
```

Run the API server:
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
Visit the local server address provided by Vite in your browser.

## Notes for Production Deployment

Deploying this application requires specific architectural considerations due to the nature of local vector storage.

### 1. Persistent Storage is Mandatory
The backend physically saves uploaded PDF files to `backend/data/uploads/` and FAISS vector indices to `backend/data/indexes/`. If you host this backend on a free-tier Platform as a Service (PaaS) like Render or Heroku, they use "ephemeral storage". This means that every time the server goes to sleep due to inactivity, the hard drive is completely wiped clean. Users will lose all their uploaded documents and vector data permanently.
**Solution:** You must deploy the backend on a Virtual Private Server (VPS) like DigitalOcean, AWS EC2, or Oracle Cloud. Alternatively, if using Render or Railway, you must attach a paid Persistent Disk Volume and configure the `data/` folder to map to that volume.

### 2. Database Hosting
The application requires a standard PostgreSQL database. You can host this yourself on the same VPS using Docker, or you can use a managed database provider like Supabase or Neon, which offer excellent free tiers. Ensure you update the database credentials in the production environment variables.

### 3. Frontend API Configuration
Before compiling the frontend for production, you must update the network interceptor. Open `frontend/src/services/api.js` and change the `BASE_URL` from `http://127.0.0.1:5000` to the actual secure HTTPS domain where your backend is hosted.

### 4. Concurrency and Web Workers
In a production environment, you should not use the built-in Flask development server (`python main.py`). You must run the application using a production WSGI server like Gunicorn or Waitress. Because the backend utilizes background threading for document ingestion (`concurrent.futures.ThreadPoolExecutor`), ensure your WSGI server is configured to support asynchronous threading so that background tasks are not abruptly terminated when the initial HTTP request concludes.