import React, { useState } from "react";
import { Plus, Trash2, Edit2, MessageSquare, Check, X } from "lucide-react";

const ChatsTab = ({ chatSessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession, onRenameSession }) => {
    
    // Group chats
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const groups = {
        "TODAY": [],
        "YESTERDAY": [],
        "EARLIER": []
    };
    
    chatSessions.forEach(chat => {
        const chatDate = new Date(parseInt(chat.id));
        if (chatDate >= today) {
            groups["TODAY"].push(chat);
        } else if (chatDate >= yesterday) {
            groups["YESTERDAY"].push(chat);
        } else {
            groups["EARLIER"].push(chat);
        }
    });

    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");

    const startEdit = (e, chat) => {
        e.stopPropagation();
        setEditingId(chat.id);
        setEditValue(chat.title);
    };

    const handleEditSave = (id) => {
        if (editValue.trim() && onRenameSession) {
            onRenameSession(id, editValue.trim());
        }
        setEditingId(null);
    };

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') handleEditSave(id);
        if (e.key === 'Escape') setEditingId(null);
    };

    const renderChatRow = (chat) => {
        const isActive = activeSessionId === chat.id;
        const docCount = chat.docIds ? chat.docIds.length : 0;
        const msgCount = chat.history ? chat.history.length : 0;
        
        return (
            <div key={chat.id} className="relative group">
                <button 
                    onClick={() => onSelectSession(chat.id)}
                    className={`
                        w-full text-left p-3 rounded-lg transition-all border
                        ${isActive 
                            ? 'bg-accent/8 border-accent/30 shadow-sm ring-1 ring-accent/10' 
                            : 'bg-surface border-border hover:border-accent/20 hover:shadow-sm'
                        }
                    `}
                >
                    <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive ? 'bg-accent text-on-accent' : 'bg-surface-2 text-text-3'
                        }`}>
                            <MessageSquare size={14} />
                        </div>
                        <div className="flex-1 min-w-0 pr-14">
                            {editingId === chat.id ? (
                                <div className="flex items-center gap-1">
                                    <input
                                        type="text"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => handleEditSave(chat.id)}
                                        onKeyDown={(e) => handleKeyDown(e, chat.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                        className="w-full bg-surface border border-accent rounded px-2 py-0.5 text-[13px] text-text outline-none"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="text-[13px] text-text font-medium truncate mb-1">
                                        {chat.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-text-3">
                                        <span>{docCount} {docCount === 1 ? 'doc' : 'docs'}</span>
                                        <span className="inline-block w-0.5 h-0.5 rounded-full bg-text-3"></span>
                                        <span>{Math.ceil(msgCount / 2)} {Math.ceil(msgCount / 2) === 1 ? 'exchange' : 'exchanges'}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </button>
                {/* Action buttons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-surface/80 backdrop-blur-sm rounded-md px-1 py-0.5 shadow-sm">
                    <button 
                        onClick={(e) => startEdit(e, chat)}
                        className="p-1.5 text-text-3 hover:bg-surface-2 hover:text-text rounded-md transition-colors"
                        title="Rename"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(chat.id); }}
                        className="p-1.5 text-text-3 hover:bg-danger/10 hover:text-danger rounded-md transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <button 
                onClick={onNewChat} 
                className="w-full bg-gradient-to-r from-accent to-blue-600 hover:from-accent-hover hover:to-blue-700 text-white py-2.5 rounded-lg text-[13px] font-semibold transition-all flex items-center justify-center gap-2 mb-5 shrink-0 shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0"
            >
                <Plus size={16} />
                <span>New chat</span>
            </button>
            
            <div className="flex-1 overflow-y-auto -mx-4 px-4 pb-4">
                {chatSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                            <MessageSquare size={20} className="text-text-3" />
                        </div>
                        <div className="text-[13px] text-text-2 font-medium mb-1">No conversations yet</div>
                        <div className="text-[12px] text-text-3">Start a new chat to ask questions about your documents</div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {groups["TODAY"].length > 0 && (
                            <div>
                                <h3 className="text-[11px] font-semibold text-text-3 tracking-[0.04em] uppercase mb-2 px-1">Today</h3>
                                <div className="flex flex-col gap-1.5">
                                    {groups["TODAY"].map(renderChatRow)}
                                </div>
                            </div>
                        )}
                        {groups["YESTERDAY"].length > 0 && (
                            <div>
                                <h3 className="text-[11px] font-semibold text-text-3 tracking-[0.04em] uppercase mb-2 px-1">Yesterday</h3>
                                <div className="flex flex-col gap-1.5">
                                    {groups["YESTERDAY"].map(renderChatRow)}
                                </div>
                            </div>
                        )}
                        {groups["EARLIER"].length > 0 && (
                            <div>
                                <h3 className="text-[11px] font-semibold text-text-3 tracking-[0.04em] uppercase mb-2 px-1">Earlier</h3>
                                <div className="flex flex-col gap-1.5">
                                    {groups["EARLIER"].map(renderChatRow)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatsTab;
