import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, ThumbsUp, ThumbsDown, Search, Paperclip, Send, Square, AlertCircle, FileText, RefreshCw, Check } from "lucide-react";
import { useToast } from "../contexts/ToastContext";

// Simple SVG Logo Mark for Assistant Avatar
const LogoMark = () => (
    <div className="w-8 h-8 bg-gradient-to-br from-accent to-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-md ring-1 ring-accent/20">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="white"/>
            <path d="M14 2V8H20" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="square"/>
        </svg>
    </div>
);

// Empty State Illustration
const EmptyStateIllustration = () => (
    <svg width="100" height="100" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4">
        <rect x="30" y="40" width="80" height="100" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="2"/>
        <rect x="40" y="30" width="80" height="100" rx="8" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2"/>
        <rect x="50" y="20" width="80" height="100" rx="8" fill="var(--surface)" stroke="var(--border)" strokeWidth="2"/>
        <line x1="65" y1="45" x2="115" y2="45" stroke="var(--border)" strokeWidth="4" strokeLinecap="round"/>
        <line x1="65" y1="65" x2="115" y2="65" stroke="var(--border)" strokeWidth="4" strokeLinecap="round"/>
        <line x1="65" y1="85" x2="95" y2="85" stroke="var(--border)" strokeWidth="4" strokeLinecap="round"/>
        <circle cx="105" cy="105" r="24" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="4"/>
        <line x1="122" y1="122" x2="140" y2="140" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"/>
    </svg>
);

const ChatArea = ({ selectedDocIds, files, onOpenSourcePreview, chatHistory, setChatHistory, onUploadClick }) => {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const chatHistoryRef = useRef(chatHistory);
    const { addToast } = useToast();

    // Keep ref in sync
    useEffect(() => {
        chatHistoryRef.current = chatHistory;
    }, [chatHistory]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [prompt]);

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setLoading(false);
            setChatHistory(prev => {
                const newHistory = [...prev];
                const last = { ...newHistory[newHistory.length - 1] };
                if (last.role === 'ai') {
                    last.isStreaming = false;
                    newHistory[newHistory.length - 1] = last;
                }
                return newHistory;
            });
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!prompt.trim() || selectedDocIds.length === 0) return;

        const userMessage = { role: 'user', content: prompt };
        const initialHistory = [...chatHistoryRef.current, userMessage, { role: 'ai', content: '', sources: [], isStreaming: true }];
        
        setChatHistory(initialHistory);
        setPrompt("");
        setLoading(true);

        const ctrl = new AbortController();
        setAbortController(ctrl);

        // Build context from previous conversation
        let apiQuestion = userMessage.content;
        const prevHistory = chatHistoryRef.current;
        if (prevHistory.length > 0) {
            let contextStr = "Previous conversation history for context:\n";
            const recent = prevHistory.slice(-4);
            for (const msg of recent) {
                if (msg.role === 'user') contextStr += `User: ${msg.content}\n`;
                if (msg.role === 'ai' && !msg.isError) contextStr += `AI: ${msg.content}\n`;
            }
            contextStr += `\nNow, answer this new question: ${userMessage.content}`;
            apiQuestion = contextStr;
        }

        try {
            const { getUserId } = await import("../services/api");
            const response = await fetch("http://127.0.0.1:5000/api/chat", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-User-Id": getUserId()
                },
                body: JSON.stringify({
                    question: apiQuestion,
                    document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined
                }),
                signal: ctrl.signal
            });

            if (!response.ok) throw new Error("Network error");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;
            let currentSources = [];
            let buffer = "";

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ""; // Keep incomplete chunk in buffer
                    
                    for (let line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.sources && data.sources.length > 0) {
                                    currentSources = data.sources;
                                }
                                setChatHistory(prev => {
                                    const newHistory = [...prev];
                                    const lastMessage = { ...newHistory[newHistory.length - 1] };
                                    if (data.error) {
                                        lastMessage.content += `\n\n[Error: ${data.error}]`;
                                        lastMessage.isError = true;
                                    }
                                    if (data.text) {
                                        lastMessage.content += data.text;
                                    }
                                    if (currentSources.length > 0) {
                                        lastMessage.sources = currentSources;
                                    }
                                    newHistory[newHistory.length - 1] = lastMessage;
                                    return newHistory;
                                });
                            } catch (err) {
                                console.error("SSE parse error on line:", line, err);
                            }
                        }
                    }
                }
            }

            setChatHistory(prev => {
                const newHistory = [...prev];
                const lastMessage = { ...newHistory[newHistory.length - 1] };
                lastMessage.isStreaming = false;
                newHistory[newHistory.length - 1] = lastMessage;
                return newHistory;
            });

        } catch (err) {
            if (err.name === 'AbortError') {
                console.log("Fetch aborted");
            } else {
                console.error(err);
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1] = { 
                        role: 'ai', 
                        content: "Could not answer right now. The answer service is busy. Try again in a minute.", 
                        sources: [], 
                        isError: true 
                    };
                    return newHistory;
                });
            }
        } finally {
            setLoading(false);
            setAbortController(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleCopy = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            addToast("Copied to clipboard", "success");
        });
    };

    const handleCopyMarkdown = () => {
        if (chatHistory.length === 0) return;
        let md = "";
        chatHistory.forEach(msg => {
            if (msg.role === 'user') md += `**User:**\n${msg.content}\n\n`;
            if (msg.role === 'ai') md += `**AskMyDocs:**\n${msg.content}\n\n`;
        });
        navigator.clipboard.writeText(md.trim()).then(() => {
            addToast("Chat copied as markdown", "success");
        });
    };

    const selectedFiles = files.filter(f => selectedDocIds.includes(f.id));

    // Empty State
    if (chatHistory.length === 0) {
        return (
            <div className="flex-1 flex flex-col h-full bg-bg relative overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center">
                    <div className="w-full max-w-[640px] flex flex-col items-center text-center">
                        <EmptyStateIllustration />
                        <h2 className="text-[18px] font-semibold text-text mb-1">Ask about your documents</h2>
                        <p className="text-text-2 text-[13px] mb-6">Search through your files, summarize reports, or extract specific data points.</p>
                        
                        {/* How it works */}
                        <div className="flex gap-3 w-full mb-6">
                            <div className="flex-1 bg-surface border border-border rounded-lg p-3 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-blue-600 text-white flex items-center justify-center text-[11px] font-bold mb-2">1</div>
                                <div className="font-medium text-text text-[13px] mb-0.5">Upload files</div>
                                <div className="text-[11px] text-text-3">PDFs, documents, or images.</div>
                            </div>
                            <div className="flex-1 bg-surface border border-border rounded-lg p-3 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-blue-600 text-white flex items-center justify-center text-[11px] font-bold mb-2">2</div>
                                <div className="font-medium text-text text-[13px] mb-0.5">Select context</div>
                                <div className="text-[11px] text-text-3">Pick files to search across.</div>
                            </div>
                            <div className="flex-1 bg-surface border border-border rounded-lg p-3 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-blue-600 text-white flex items-center justify-center text-[11px] font-bold mb-2">3</div>
                                <div className="font-medium text-text text-[13px] mb-0.5">Ask away</div>
                                <div className="text-[11px] text-text-3">Get answers with citations.</div>
                            </div>
                        </div>
                        
                        {selectedDocIds.length > 0 && (
                            <div className="w-full text-left">
                                <h3 className="text-[11px] font-semibold text-text-3 tracking-[0.04em] uppercase mb-3">Suggested questions</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {selectedFiles.slice(0, 4).map((f) => (
                                        <button 
                                            key={f.id}
                                            onClick={() => {
                                                setPrompt(`Summarize the main points of ${f.filename}`);
                                                setTimeout(() => textareaRef.current?.focus(), 0);
                                            }}
                                            className="text-left bg-surface border border-border rounded-lg p-3 hover:border-accent hover:shadow-md transition-all group"
                                        >
                                            <div className="text-[13px] text-text font-medium mb-0.5 group-hover:text-accent transition-colors truncate">Summarize {f.filename}</div>
                                            <div className="text-[11px] text-text-3 truncate">Extract key takeaways.</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <Composer 
                    prompt={prompt} setPrompt={setPrompt} loading={loading} handleSubmit={handleSubmit} 
                    handleStop={handleStop} handleKeyDown={handleKeyDown} textareaRef={textareaRef} 
                    selectedCount={selectedDocIds.length} totalCount={files.length} 
                    onUploadClick={onUploadClick}
                />
            </div>
        );
    }

    // Conversation State
    return (
        <div className="flex-1 flex flex-col h-full bg-bg relative">
            
            {/* Chat Header */}
            <div className="flex-none h-12 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center justify-between px-6 z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="font-medium text-text text-[14px] truncate">Current Conversation</div>
                    <div className="w-[1px] h-4 bg-border"></div>
                    <div className="flex gap-1.5 overflow-hidden">
                        {selectedFiles.slice(0, 3).map(f => (
                            <div key={f.id} className="flex items-center gap-1.5 bg-sidebar border border-border rounded-full pl-1.5 pr-2 py-0.5 shrink-0 max-w-[140px]">
                                <FileText size={11} className="text-text-3 shrink-0" />
                                <span className="text-[11px] font-medium text-text-2 truncate">{f.filename}</span>
                            </div>
                        ))}
                        {selectedFiles.length > 3 && (
                            <div className="flex items-center text-[11px] text-text-3 font-medium px-1.5">+{selectedFiles.length - 3} more</div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button onClick={handleCopyMarkdown} className="text-[12px] font-medium text-text-2 hover:text-text px-2 py-1 rounded hover:bg-sidebar transition-colors">Copy as Markdown</button>
                    <button onClick={() => setChatHistory([])} className="text-[12px] font-medium text-danger hover:bg-danger/10 px-2 py-1 rounded transition-colors">Clear chat</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center" aria-live="polite">
                <div className="w-full max-w-[720px] flex flex-col gap-8 pb-8">
                    {chatHistory.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        
                        if (isUser) {
                            return (
                                <div key={idx} className="flex gap-4 w-full">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-tint to-blue-100 text-accent font-bold text-[12px] flex items-center justify-center shrink-0 ring-1 ring-accent/10">U</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="bg-surface-2 px-4 py-3 rounded-xl text-[15px] text-text whitespace-pre-wrap rounded-tl-none inline-block max-w-[90%]">
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Error State
                        if (msg.isError) {
                            return (
                                <div key={idx} className="flex gap-4 w-full">
                                    <LogoMark />
                                    <div className="flex-1 min-w-0">
                                        <div className="bg-surface border-l-4 border-l-danger border-y border-r border-border shadow-sm rounded-r-lg p-4 inline-block max-w-[90%]">
                                            <div className="flex items-center gap-2 text-danger font-medium text-[14px] mb-1">
                                                <AlertCircle size={16} />
                                                Something went wrong
                                            </div>
                                            <div className="text-[14px] text-text-2 mb-3">{msg.content}</div>
                                            <button 
                                                onClick={() => {
                                                    const lastUserMsg = chatHistory[idx - 1];
                                                    if (lastUserMsg) {
                                                        setPrompt(lastUserMsg.content);
                                                        setChatHistory(prev => prev.slice(0, -2));
                                                    }
                                                }}
                                                className="bg-surface-2 hover:bg-border text-text px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1.5"
                                            >
                                                <RefreshCw size={12} />
                                                Try again
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // Assistant Message
                        return (
                            <div key={idx} className="flex gap-4 w-full group">
                                <LogoMark />
                                <div className="flex-1 min-w-0">
                                    <div className="bg-surface border border-border shadow-sm rounded-xl rounded-tl-none p-5 relative overflow-hidden">
                                        
                                        {msg.content === "" && msg.isStreaming ? (
                                            <div className="flex items-center gap-2 text-text-3 font-medium text-[14px]">
                                                <Search size={16} className="animate-pulse" />
                                                Searching {selectedDocIds.length} {selectedDocIds.length === 1 ? 'document' : 'documents'}...
                                            </div>
                                        ) : (
                                            <div className="prose prose-sm max-w-none text-text prose-p:leading-[1.6] prose-pre:bg-sidebar prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-code:font-mono">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {/* Streaming indicator */}
                                        {msg.isStreaming && msg.content !== "" && (
                                            <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse rounded-sm"></span>
                                        )}

                                        {/* Sources Row */}
                                        {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                                            <div className="mt-6 pt-4 border-t border-border">
                                                <h4 className="text-[11px] font-semibold text-text-3 uppercase tracking-[0.04em] mb-3">Sources</h4>
                                                <div className="flex overflow-x-auto gap-3 pb-2 -mx-2 px-2 snap-x">
                                                    {msg.sources.map((src, sIdx) => (
                                                        <div 
                                                            key={sIdx} 
                                                            onClick={() => onOpenSourcePreview(src)}
                                                            className="w-[180px] shrink-0 bg-surface border border-border rounded-lg p-2.5 hover:shadow-md hover:-translate-y-[1px] cursor-pointer transition-all snap-start flex flex-col group/src"
                                                        >
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <span className="bg-accent-tint text-accent text-[10px] px-1.5 py-0.5 rounded font-bold">{sIdx + 1}</span>
                                                                <span className="font-mono text-[11px] text-text truncate font-medium">{src.filename}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] text-text-3 mb-1.5">
                                                                <span>Page {src.page}</span>
                                                                <span className="uppercase tracking-wide">{src.content_type}</span>
                                                            </div>
                                                            <p className="text-[11px] text-text-2 line-clamp-2 leading-relaxed group-hover/src:text-text transition-colors">{src.snippet}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Actions Row */}
                                        {!msg.isStreaming && (
                                            <div className="mt-4 flex items-center justify-between">
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleCopy(msg.content)} className="p-1.5 text-text-3 hover:text-text hover:bg-black/5 rounded-md transition-colors" title="Copy text"><Copy size={14} /></button>
                                                    <button className="p-1.5 text-text-3 hover:text-success hover:bg-success/10 rounded-md transition-colors" title="Helpful"><ThumbsUp size={14} /></button>
                                                    <button className="p-1.5 text-text-3 hover:text-danger hover:bg-danger/10 rounded-md transition-colors" title="Not helpful"><ThumbsDown size={14} /></button>
                                                </div>
                                                <div className="text-[11px] text-text-3 select-none">
                                                    Generated by AskMyDocs
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            
            <Composer 
                prompt={prompt} setPrompt={setPrompt} loading={loading} handleSubmit={handleSubmit} 
                handleStop={handleStop} handleKeyDown={handleKeyDown} textareaRef={textareaRef} 
                selectedCount={selectedDocIds.length} totalCount={files.length} 
                onUploadClick={onUploadClick}
            />
        </div>
    );
};

const Composer = ({ prompt, setPrompt, loading, handleSubmit, handleStop, handleKeyDown, textareaRef, selectedCount, totalCount, onUploadClick }) => {
    const disabled = selectedCount === 0;
    const [focused, setFocused] = useState(false);

    return (
        <div className="flex-none p-4 pb-5 flex justify-center bg-bg relative z-20">
            <div className={`w-full max-w-[720px] bg-surface rounded-2xl transition-all duration-300 border ${focused ? 'border-accent shadow-[0_0_0_3px_rgba(37,99,235,0.15)]' : 'border-border hover:border-accent/40 shadow-sm'}`}>
                <textarea 
                    ref={textareaRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    disabled={disabled || loading}
                    className="w-full bg-transparent px-4 py-3 text-[15px] focus:outline-none resize-none max-h-[160px] disabled:opacity-50 min-h-[60px]"
                    rows={1}
                    placeholder={disabled ? "Select at least one document to ask a question." : "Ask a question..."}
                />
                <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <button 
                            onClick={onUploadClick}
                            className="p-1.5 text-text-3 hover:text-accent rounded-md hover:bg-accent/10 transition-colors shrink-0" 
                            title="Attach files"
                        >
                            <Paperclip size={18} />
                        </button>
                        <div className={`text-[12px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap truncate ${selectedCount > 0 ? 'text-accent bg-accent-tint' : 'text-text-3 bg-surface-2'}`}>
                            {selectedCount > 0 ? `${selectedCount}/${totalCount} selected` : `No docs`}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-text-3 font-medium">
                            <span className="bg-sidebar border border-border px-1.5 py-0.5 rounded shadow-sm">Enter</span> to send
                            <span className="bg-sidebar border border-border px-1.5 py-0.5 rounded shadow-sm ml-1">Shift+Enter</span> new line
                        </div>
                        {loading ? (
                            <button onClick={handleStop} className="w-8 h-8 rounded-md bg-surface-2 text-text flex items-center justify-center hover:bg-border transition-colors">
                                <Square size={14} fill="currentColor" />
                            </button>
                        ) : (
                            <button 
                                onClick={handleSubmit} 
                                disabled={disabled || !prompt.trim()} 
                                className={`h-8 px-4 rounded-lg text-[14px] font-medium flex items-center gap-2 transition-all ${
                                    !disabled && prompt.trim() 
                                    ? 'bg-gradient-to-r from-accent to-blue-600 text-on-accent shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0' 
                                    : 'bg-surface-2 text-text-3 cursor-not-allowed'
                                }`}
                            >
                                Send
                                <Send size={14} className={!disabled && prompt.trim() ? "text-on-accent" : ""} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatArea;
