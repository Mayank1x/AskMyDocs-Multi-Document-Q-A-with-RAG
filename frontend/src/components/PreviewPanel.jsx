import React, { useState } from "react";
import { X, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { getUserId } from "../services/api";

const PreviewPanel = ({ source, files = [], onClose }) => {
    const fileExt = source?.filename?.split('.').pop().toLowerCase() || '';
    const isViewable = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fileExt);
    
    const [activeTab, setActiveTab] = useState(isViewable ? "Preview" : "Extracted text");
    
    // Sync tab when source changes to avoid getting stuck on Preview for docx
    React.useEffect(() => {
        if (!isViewable && activeTab === "Preview") {
            setActiveTab("Extracted text");
        }
    }, [source?.filename, isViewable]);

    if (!source) return null;

    const getTypeColor = (ext) => {
        if (['pdf'].includes(ext)) return 'var(--type-pdf)';
        if (['docx', 'doc'].includes(ext)) return 'var(--type-docx)';
        if (['pptx', 'ppt'].includes(ext)) return 'var(--type-pptx)';
        if (['csv', 'xlsx', 'xls'].includes(ext)) return 'var(--type-csv)';
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'var(--type-image)';
        return 'var(--type-text)';
    };

    return (
        <aside className={`
            absolute lg:static top-0 right-0 h-full bg-surface border-l border-border
            w-full lg:w-[420px] shrink-0 z-40 flex flex-col
            shadow-md lg:shadow-none transition-transform
        `}>
            {/* Header */}
            <div className="flex flex-col border-b border-border p-3 gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div 
                            className="w-6 h-6 rounded flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: getTypeColor(fileExt) }}
                        >
                            <span className="text-white text-[9px] font-bold uppercase tracking-tight">{fileExt.substring(0, 4)}</span>
                        </div>
                        <div className="font-mono text-[13px] font-medium text-text truncate">
                            {source.filename}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-text-3 hover:text-text hover:bg-black/5 rounded-md transition-colors shrink-0" aria-label="Close preview">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center bg-sidebar rounded p-1">
                        <button 
                            onClick={() => setActiveTab("Preview")} 
                            className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${activeTab === "Preview" ? "bg-surface shadow-sm text-text" : "text-text-2 hover:text-text"}`}
                        >
                            Preview
                        </button>
                        <button 
                            onClick={() => setActiveTab("Extracted text")} 
                            className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${activeTab === "Extracted text" ? "bg-surface shadow-sm text-text" : "text-text-2 hover:text-text"}`}
                        >
                            Extracted text
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] text-text-3 font-medium">Page {source.page || 1}</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-bg overflow-hidden relative">
                {activeTab === "Extracted text" ? (
                    <div className="h-full overflow-y-auto p-4">
                        <div className="bg-surface border border-border rounded-lg shadow-sm p-5 h-full overflow-y-auto">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                                <span className="text-[12px] font-medium text-text-3">Page {source.page || 1}</span>
                                <span className="text-[11px] font-bold text-accent bg-accent-tint px-2 py-0.5 rounded tracking-wide uppercase">
                                    {source.content_type === 'ocr' ? 'OCR' : source.content_type === 'image' ? 'Image' : 'Text'}
                                </span>
                            </div>
                            <div className="font-mono text-[14px] leading-relaxed text-text whitespace-pre-wrap">
                                {source.full_text || source.snippet}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full w-full bg-sidebar flex flex-col items-center justify-center p-4">
                        {!isViewable ? (
                            <div className="flex flex-col items-center text-center p-8 text-text-3">
                                <FileText size={48} className="mb-4 opacity-30" />
                                <p className="font-medium text-text mb-2">No preview available</p>
                                <p className="text-[12px] mb-6">This file type cannot be displayed directly in the browser.</p>
                                <button onClick={() => setActiveTab("Extracted text")} className="px-4 py-2 bg-surface-2 hover:bg-surface border border-border text-text rounded-md text-[13px] transition-colors font-medium shadow-sm">
                                    View extracted text
                                </button>
                            </div>
                        ) : (() => {
                            const matchedFile = files.find(f => f.filename === source.filename);
                            if (!matchedFile) {
                                return <div className="text-sm text-text-3">Document file not available for preview.</div>;
                            }
                            return (
                                <iframe 
                                    src={`http://127.0.0.1:5000/api/documents/${matchedFile.id}/file?user_id=${getUserId()}#page=${source.page || 1}`}
                                    className="w-full h-full bg-white border border-border rounded shadow-sm"
                                    title="Document Preview"
                                />
                            );
                        })()}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default PreviewPanel;
