# Suggestions and Fixes

## Error: "The answer service is busy" on simple "hi"
The real cause of this error was a nonexistent model name configured in the backend. 
When the backend received a simple greeting like "hi", it bypassed document retrieval and immediately tried to send a prompt to the LLM to generate a conversational response. However, `chain.py` was hardcoded to use `gemini-3.5-flash` for the model name. Since this model does not exist, the Google GenAI SDK threw an exception (500 Internal Server Error) which broke the streaming connection. The frontend gracefully caught this fetch error and displayed the fallback text "Could not answer right now. The answer service is busy."

**Fix applied:** The model name was corrected to `gemini-1.5-flash` in `app/rag/chain.py`. Restarting the backend resolves the bug.

## Ideas for Future Scope
- Implementing proper toast notifications context for "Copied" and "Upload Complete" to remove browser alerts.
- Creating a global drag-and-drop overlay for uploading anywhere on the screen.
- Better Markdown inline source citation parsing (custom ReactMarkdown components) so that `[1]` chips can trigger hover popovers.
