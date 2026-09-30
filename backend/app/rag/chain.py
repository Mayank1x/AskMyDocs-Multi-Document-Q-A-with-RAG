import json
import os
import traceback
import time
from typing import List, Optional
from google import genai
from google.genai import errors as genai_errors
from app.rag.retriever import retrieve_and_rerank

import re

# Ordered list of models to try. When one hits a rate limit, we fall through to the next.
# Each model has different free-tier quotas, so cycling through them effectively multiplies
# your available requests.
GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.0-flash",
]

def _try_generate_stream(client, prompt, models=None):
    """
    Attempts to stream a response from Gemini, falling back through
    multiple models and retrying if a rate-limit (429) or high-demand (503) error is encountered.
    
    Returns: (model_name, response_iterator) on success
    Raises: the last exception if ALL models fail
    """
    import time
    models = models or GEMINI_MODELS
    last_error = None
    
    # We will try the whole model list 2 times with a delay if we hit 503s
    for attempt in range(2):
        for model in models:
            try:
                response = client.models.generate_content_stream(
                    model=model,
                    contents=prompt
                )
                # Streams are lazy. 503 errors often trigger on the first read.
                # We peek at the first chunk to catch these errors here.
                response_iter = iter(response)
                first_chunk = next(response_iter)
                
                def wrapped_generator():
                    yield first_chunk
                    for chunk in response_iter:
                        yield chunk
                        
                return model, wrapped_generator()
            except StopIteration:
                # Empty stream but no error, this is fine
                return model, iter([])
            except Exception as e:
                error_str = str(e)
                last_error = e
                is_transient = any(code in error_str.upper() for code in ["429", "503", "500", "RESOURCE_EXHAUSTED", "QUOTA", "UNAVAILABLE"])
                if is_transient:
                    import sys
                    sys.stderr.write(f"[Model Fallback] {model} hit rate limit or high demand on attempt {attempt+1}.\n")
                    sys.stderr.flush()
                    continue
                else:
                    # Non-rate-limit error (e.g. 404), don't retry with other models
                    sys.stderr.write(f"[Fatal Error] {model} failed with non-transient error: {error_str}\n")
                    sys.stderr.flush()
                    # We continue to the next model in case just one model is 404
                    continue
                    
        # If we exhausted all models on this attempt, sleep before the next attempt
        if attempt < 1:
            time.sleep(2)
            
    # All models exhausted
    raise last_error


def chat_with_docs(question: str, user_id: str, document_ids: Optional[List[int]] = None):
    """
    Retrieves context, formats it, calls Gemini with automatic model fallback,
    and yields the response as Server-Sent Events (SSE).
    """
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        yield f"data: {json.dumps({'text': 'API key not configured. Please set GEMINI_API_KEY in your .env file.', 'sources': []})}\n\n"
        return
    
    client = genai.Client(api_key=api_key)
    
    # Check for basic conversational greetings to bypass retrieval
    clean_q = re.sub(r'[^a-zA-Z]', '', question.lower())
    is_greeting = clean_q in ["hi", "hello", "hey", "thanks", "thankyou", "ok", "okay", "goodmorning", "goodafternoon", "goodevening"]
    
    docs = []
    if not is_greeting:
        try:
            docs = retrieve_and_rerank(question, user_id, document_ids)
        except Exception as e:
            print(f"Retrieval error: {e}\n{traceback.format_exc()}")
            yield f"data: {json.dumps({'text': 'An error occurred while searching your documents. Please try again.', 'sources': []})}\n\n"
            return
    
    if not docs and not is_greeting:
        yield f"data: {json.dumps({'text': 'I could not find any relevant documents to answer your question. Please make sure you have uploaded and selected documents first.', 'sources': []})}\n\n"
        return
        
    # Format context and sources
    context_parts = []
    sources = []
    for doc in docs:
        meta = doc.metadata
        filename = meta.get('filename', '')
        if len(filename) > 65 and filename[64] == '_':
            filename = filename[65:]
            
        context_parts.append(f"--- Source: {filename} (Page {meta.get('page')}) ---\n{doc.page_content}")
        
        sources.append({
            "filename": filename,
            "page": meta.get("page"),
            "content_type": meta.get("content_type"),
            "snippet": doc.page_content[:150] + "..." if len(doc.page_content) > 150 else doc.page_content,
            "full_text": doc.page_content
        })
        
    context_str = "\n\n".join(context_parts)
    
    if is_greeting:
        prompt = f"You are a helpful AI assistant called AskMyDocs. The user just said: '{question}'. Respond politely and briefly."
    else:
        prompt = f"""You are a helpful assistant called AskMyDocs. Answer the user's question based strictly on the provided document context. 
If the answer cannot be found in the context, say "I couldn't find that in your documents." Do not invent information.
Use markdown formatting for your answer when appropriate (lists, bold, headers).

Context:
{context_str}

Question: {question}
Answer:"""

    try:
        model_used, response = _try_generate_stream(client, prompt)
        print(f"[Gemini] Using model: {model_used}")
        
        first_chunk = True
        for chunk in response:
            text_part = ""
            try:
                if chunk.text:
                    text_part = chunk.text
            except ValueError:
                # Extract text manually if chunk contains non-text parts (e.g. thoughts)
                if chunk.candidates and chunk.candidates[0].content and chunk.candidates[0].content.parts:
                    for p in chunk.candidates[0].content.parts:
                        if hasattr(p, 'text') and p.text:
                            text_part += p.text
                            
            if text_part:
                chunk_sources = sources if first_chunk else []
                yield f"data: {json.dumps({'text': text_part, 'sources': chunk_sources})}\n\n"
                first_chunk = False
                
    except Exception as e:
        error_msg = str(e)
        import sys
        sys.stderr.write(f"Gemini API error (all models failed): {error_msg}\n{traceback.format_exc()}\n")
        sys.stderr.flush()
        
        with open("gemini_error.log", "w") as f:
            f.write(f"Error: {error_msg}\nTraceback: {traceback.format_exc()}\n")
            
        if "quota" in error_msg.lower() or "rate" in error_msg.lower() or "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            user_msg = "All available Gemini models have hit their rate limits. Please wait a minute and try again."
        elif "invalid" in error_msg.lower() or "key" in error_msg.lower():
            user_msg = "API key is invalid. Please check your GEMINI_API_KEY in the .env file."
        elif "safety" in error_msg.lower() or "block" in error_msg.lower():
            user_msg = "The response was blocked by safety filters. Please try rephrasing your question."
        else:
            user_msg = "An error occurred while generating the answer. Please try again."
            
        yield f"data: {json.dumps({'text': user_msg, 'sources': []})}\n\n"
