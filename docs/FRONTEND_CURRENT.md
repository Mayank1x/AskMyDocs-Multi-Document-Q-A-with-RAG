# Current Frontend Architecture

## Pages
- `Home.jsx`: The only page. Layout consists of a left section with `FileUpload` and `DocumentGrid`, and a right section with `ChatWithAI`. It handles state for `files`, `selectedDocIds`, and polling the API every 2 seconds for document statuses.

## Components
- `Layout.jsx`: Wrapper for the app providing navbar and main layout bounds.
- `FileUpload.jsx`: Renders the upload dropzone and button.
- `DocumentGrid.jsx`: Renders a grid of `FileCard` components.
- `FileCard.jsx`: Shows individual document info (name, status, delete button).
- `ChatWithAI.jsx`: The main chat interface. Submits to `/api/chat` and reads SSE streams.
- `Loader.jsx`: Generic loading spinners.
- `FileList.jsx`: Not used.

## API Calls (`services/api.js`)
- `uploadDocument(formData)`: POST to `/api/documents`
- `getFiles()`: GET from `/api/documents`
- `getFile(id)`: GET from `/api/documents` (currently mocked in api.js)
- `deleteFile(id)`: DELETE from `/api/documents/${id}`
- `chatWithFile(id, question)`: POST to `/api/chat` (Though `ChatWithAI.jsx` bypasses this and uses native `fetch` for SSE).
