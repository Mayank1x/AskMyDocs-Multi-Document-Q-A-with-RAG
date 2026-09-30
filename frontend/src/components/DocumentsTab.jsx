import React, { useState } from "react";
import { Upload, RefreshCw, Trash2, Search, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { deleteFile } from "../services/api";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "../contexts/ToastContext";

const DocumentsTab = ({ 
    files, setFiles, 
    selectedDocIds, setSelectedDocIds,
    onUploadClick
}) => {
    const [sort, setSort] = useState("Name");
    const [deletingId, setDeletingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);
    const { addToast } = useToast();

    const handleSelectAll = () => {
        const readyIds = files.filter(f => f.status === 'ready').map(f => f.id);
        setSelectedDocIds(readyIds);
    };

    const handleClear = () => {
        setSelectedDocIds([]);
    };

    const handleToggle = (id) => {
        setSelectedDocIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            await deleteFile(id);
            setFiles(prev => prev.filter(f => f.id !== id));
            setSelectedDocIds(prev => prev.filter(selectedId => selectedId !== id));
            addToast("Document deleted", "info");
        } catch (err) {
            console.error("Delete failed", err);
            addToast("Failed to delete document", "error");
        } finally {
            setDeletingId(null);
        }
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

    // Sort and filter files
    const sortedFiles = [...files]
        .filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => {
            if (sort === 'Name') return a.filename.localeCompare(b.filename);
            if (sort === 'Date') return b.id - a.id;
            return 0;
        });

    // Stats
    const readyCount = files.filter(f => f.status === 'ready').length;
    const totalPages = files.reduce((sum, f) => sum + (f.pages_count || 0), 0);
    const totalChunks = files.reduce((sum, f) => sum + (f.chunks_count || 0), 0);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            
            {/* Stat tiles */}
            <div className="flex gap-2 mb-5 shrink-0">
                <div className="flex-1 bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-lg p-2.5 flex flex-col items-center justify-center">
                    <span className="text-[20px] font-bold text-accent leading-none mb-1">{readyCount}</span>
                    <span className="text-[10px] text-accent/70 font-semibold tracking-[0.04em] uppercase">Ready</span>
                </div>
                <div className="flex-1 bg-surface border border-border rounded-lg p-2.5 flex flex-col items-center justify-center">
                    <span className="text-[20px] font-bold text-text leading-none mb-1">{totalPages}</span>
                    <span className="text-[10px] text-text-3 font-semibold tracking-[0.04em] uppercase">Pages</span>
                </div>
                <div className="flex-1 bg-surface border border-border rounded-lg p-2.5 flex flex-col items-center justify-center">
                    <span className="text-[20px] font-bold text-text leading-none mb-1">{totalChunks}</span>
                    <span className="text-[10px] text-text-3 font-semibold tracking-[0.04em] uppercase">Chunks</span>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4 shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-3" />
                <input 
                    type="text" 
                    placeholder="Search documents..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-[13px] text-text focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                />
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                <h3 className="text-[11px] font-semibold text-text-3 tracking-[0.04em] uppercase">
                    {selectedDocIds.length > 0 ? `${selectedDocIds.length} selected` : 'Your Documents'}
                </h3>
                <div className="flex items-center gap-3 text-[12px]">
                    <div className="flex gap-2">
                        <button onClick={handleSelectAll} className="text-accent hover:text-accent-hover font-medium transition-colors">All</button>
                        <span className="text-border">·</span>
                        <button onClick={handleClear} className="text-text-3 hover:text-text font-medium transition-colors">Clear</button>
                    </div>
                    <select 
                        value={sort} 
                        onChange={e => setSort(e.target.value)}
                        className="bg-transparent text-text-2 hover:text-text cursor-pointer outline-none font-medium text-[12px]"
                    >
                        <option value="Name">Name</option>
                        <option value="Date">Date</option>
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto -mx-4 px-4 pb-4">
                <div className="flex flex-col gap-1.5">
                    {sortedFiles.length === 0 && files.length > 0 && (
                        <div className="text-center text-text-3 text-[13px] py-8">No documents match "{searchQuery}"</div>
                    )}
                    {sortedFiles.map(f => {
                        const isReady = f.status === 'ready';
                        const isFailed = f.status === 'failed';
                        const isProcessing = !isReady && !isFailed;
                        const isSelected = selectedDocIds.includes(f.id);
                        const ext = getFileExt(f.filename);
                        
                        return (
                            <div 
                                key={f.id} 
                                onClick={() => isReady && handleToggle(f.id)}
                                className={`
                                    relative flex items-center gap-3 p-2.5 rounded-lg transition-all group cursor-pointer border
                                    ${isSelected 
                                        ? 'bg-accent/8 border-accent/40 shadow-sm ring-1 ring-accent/10' 
                                        : 'bg-surface border-border hover:border-accent/30 hover:shadow-sm'
                                    }
                                    ${!isReady ? 'opacity-70 cursor-default' : ''}
                                `}
                            >
                                {/* Checkbox */}
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                                    isSelected 
                                        ? 'bg-accent border-accent' 
                                        : 'border-border group-hover:border-accent/40'
                                } ${!isReady ? 'opacity-40' : ''}`}>
                                    {isSelected && (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </div>
                                
                                {/* File Badge */}
                                <div 
                                    className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center shadow-sm"
                                    style={{ backgroundColor: getTypeColor(ext) }}
                                >
                                    <span className="text-white text-[10px] font-bold uppercase tracking-tight">{ext.substring(0, 4)}</span>
                                </div>
                                
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="text-[13px] text-text font-medium truncate" title={f.filename}>
                                        {f.filename}
                                    </div>
                                    <div className="text-[11px] text-text-3 mt-0.5">
                                        {isReady && (
                                            <span className="flex items-center gap-1">
                                                {f.pages_count || 1} {(f.pages_count || 1) === 1 ? 'page' : 'pages'}
                                                <span className="inline-block w-0.5 h-0.5 rounded-full bg-text-3 mx-1"></span>
                                                {f.chunks_count || 0} chunks
                                            </span>
                                        )}
                                        {isProcessing && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Loader2 size={10} className="animate-spin text-accent" />
                                                <span className="text-accent text-[11px]">
                                                    {f.status.startsWith('page') ? f.status : 'Processing...'}
                                                </span>
                                            </div>
                                        )}
                                        {isFailed && (
                                            <span className="text-danger text-[11px] truncate" title={f.error_message}>
                                                Failed
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Status & Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {isReady && (
                                        <CheckCircle2 size={14} className="text-success" />
                                    )}
                                    {isProcessing && (
                                        <div className="w-14 h-1 bg-surface-2 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-accent to-blue-400 animate-indeterminate"></div>
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: f.id, filename: f.filename }); }}
                                        disabled={deletingId === f.id}
                                        className={`p-1.5 rounded-md transition-colors ${
                                            isFailed 
                                                ? 'text-danger hover:bg-danger/10' 
                                                : 'text-text-3 hover:text-danger hover:bg-danger/10'
                                        }`}
                                        aria-label="Delete document"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Upload Drop Zone */}
                    <button 
                        onClick={onUploadClick}
                        className="mt-4 w-full p-6 border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 rounded-xl flex flex-col items-center justify-center transition-all group"
                    >
                        <div className="w-10 h-10 rounded-full bg-surface-2 group-hover:bg-accent/10 flex items-center justify-center mb-3 transition-colors">
                            <Upload size={20} className="text-text-3 group-hover:text-accent transition-colors" />
                        </div>
                        <span className="text-[13px] font-medium text-text mb-1">Drop files here or browse</span>
                        <span className="text-[11px] text-text-3 text-center">PDF, DOCX, PPTX, CSV, images up to 20 MB</span>
                    </button>
                </div>
            </div>

            <ConfirmDialog 
                isOpen={!!confirmDelete}
                title="Delete Document"
                message={confirmDelete ? `Delete ${confirmDelete.filename}? Its content will be removed from search.` : ""}
                confirmText="Delete"
                isDanger={true}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
            />

            {/* Animated indeterminate progress bar */}
            <style>{`
                @keyframes indeterminate {
                    0% { transform: translateX(-100%); width: 40%; }
                    50% { width: 60%; }
                    100% { transform: translateX(250%); width: 40%; }
                }
                .animate-indeterminate {
                    animation: indeterminate 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default DocumentsTab;
