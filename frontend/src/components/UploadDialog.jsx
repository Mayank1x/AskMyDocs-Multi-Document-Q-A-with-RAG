import React, { useState, useRef, useEffect } from "react";
import { X, Upload as UploadIcon, FileText, CheckCircle2, AlertCircle } from "lucide-react";

const UploadDialog = ({ isOpen, onClose, onUpload }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleGlobalDrop = (e) => {
            if (isOpen && e.detail) {
                handleFiles(e.detail);
            }
        };
        window.addEventListener('globalFileDrop', handleGlobalDrop);
        return () => window.removeEventListener('globalFileDrop', handleGlobalDrop);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFiles = (files) => {
        const newFiles = Array.from(files).map(f => ({
            file: f,
            id: Math.random().toString(36).substring(7),
            name: f.name,
            size: f.size,
            status: 'queued', // queued, uploading, done, error
            progress: 0
        }));
        
        setSelectedFiles(prev => [...newFiles, ...prev]);
        
        // Auto-upload them
        newFiles.forEach(uploadFile);
    };

    const uploadFile = async (fileObj) => {
        setSelectedFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'uploading', progress: 30 } : f));
        
        const formData = new FormData();
        formData.append("files", fileObj.file);

        try {
            await onUpload(formData);
            setSelectedFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'done', progress: 100 } : f));
        } catch (err) {
            setSelectedFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', progress: 0, error: err.message } : f));
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileExt = (filename) => filename.split('.').pop().toLowerCase();
    
    const getTypeColor = (ext) => {
        if (['pdf'].includes(ext)) return 'var(--type-pdf)';
        if (['docx', 'doc'].includes(ext)) return 'var(--type-docx)';
        if (['pptx', 'ppt'].includes(ext)) return 'var(--type-pptx)';
        if (['csv', 'xlsx', 'xls'].includes(ext)) return 'var(--type-csv)';
        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'var(--type-image)';
        return 'var(--type-text)';
    };

    const removeFile = (id) => {
        setSelectedFiles(prev => prev.filter(f => f.id !== id));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-surface rounded-lg shadow-md w-full max-w-2xl flex flex-col max-h-[85vh] border border-border">
                
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-[16px] font-semibold text-text">Upload Documents</h2>
                    <button onClick={onClose} className="p-1.5 text-text-3 hover:text-text hover:bg-sidebar rounded-md transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {/* Drop Zone */}
                    <div 
                        className={`w-full p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors mb-6 ${
                            isDragging ? 'border-accent bg-accent-tint/30' : 'border-border bg-sidebar/50'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                    >
                        <div className="w-12 h-12 rounded-full bg-surface shadow-sm border border-border flex items-center justify-center mb-4 text-accent">
                            <UploadIcon size={24} />
                        </div>
                        <h3 className="text-[15px] font-medium text-text mb-1">Drag and drop files here</h3>
                        <p className="text-[13px] text-text-3 mb-4">PDF, DOCX, PPTX, CSV, images up to 20MB</p>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-surface border border-border hover:bg-black/5 text-text font-medium px-4 py-2 rounded-md transition-colors shadow-sm text-[13px]"
                        >
                            Browse files
                        </button>
                        <input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={(e) => handleFiles(e.target.files)} 
                        />
                    </div>

                    {/* File List */}
                    {selectedFiles.length > 0 && (
                        <div className="flex flex-col gap-3">
                            <h4 className="text-[12px] font-semibold text-text-3 uppercase tracking-[0.04em]">Uploads</h4>
                            <div className="flex flex-col gap-2">
                                {selectedFiles.map(f => {
                                    const ext = getFileExt(f.name);
                                    return (
                                        <div key={f.id} className="bg-surface border border-border rounded-md p-3 flex items-center gap-3">
                                            <div 
                                                className="w-8 h-8 rounded shrink-0 flex items-center justify-center shadow-sm"
                                                style={{ backgroundColor: getTypeColor(ext) }}
                                            >
                                                <span className="text-white text-[10px] font-bold uppercase tracking-tight">{ext.substring(0, 4)}</span>
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[13px] font-medium text-text truncate pr-2">{f.name}</span>
                                                    <span className="text-[11px] text-text-3 shrink-0">{formatSize(f.size)}</span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-sidebar rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-300 ${f.status === 'error' ? 'bg-danger' : f.status === 'done' ? 'bg-success' : 'bg-accent'}`}
                                                            style={{ width: `${f.progress}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="text-[11px] font-medium shrink-0 min-w-[50px] text-right">
                                                        {f.status === 'queued' && <span className="text-text-3">Queued</span>}
                                                        {f.status === 'uploading' && <span className="text-accent">Uploading</span>}
                                                        {f.status === 'done' && <span className="text-success flex items-center justify-end gap-1"><CheckCircle2 size={12}/> Done</span>}
                                                        {f.status === 'error' && <span className="text-danger flex items-center justify-end gap-1"><AlertCircle size={12}/> Failed</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="shrink-0 ml-2">
                                                {f.status === 'error' ? (
                                                    <button onClick={() => uploadFile(f)} className="text-[12px] font-medium text-accent hover:text-accent-hover transition-colors">Retry</button>
                                                ) : f.status === 'done' ? (
                                                    <button onClick={() => removeFile(f.id)} className="p-1 text-text-3 hover:text-danger rounded transition-colors"><X size={16} /></button>
                                                ) : (
                                                    <button onClick={() => removeFile(f.id)} className="p-1 text-text-3 hover:text-danger rounded transition-colors"><X size={16} /></button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadDialog;
