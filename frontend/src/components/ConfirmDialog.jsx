import React from "react";
import { AlertTriangle } from "lucide-react";

const ConfirmDialog = ({ isOpen, title, message, confirmText, cancelText, onConfirm, onClose, isDanger }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-surface rounded-lg shadow-md w-full max-w-sm flex flex-col overflow-hidden border border-border">
                <div className="p-5">
                    <div className="flex gap-3 items-start mb-2">
                        {isDanger && <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />}
                        <h2 className="text-[16px] font-semibold text-text">{title}</h2>
                    </div>
                    <p className="text-[14px] text-text-2 mb-6 ml-[32px]">{message}</p>
                    <div className="flex items-center justify-end gap-3 mt-2">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-[14px] font-medium text-text-2 hover:text-text hover:bg-black/5 rounded-md transition-colors"
                        >
                            {cancelText || "Cancel"}
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`px-4 py-2 text-[14px] font-medium rounded-md transition-colors ${
                                isDanger 
                                ? "bg-danger hover:bg-danger/90 text-white shadow-sm" 
                                : "bg-accent hover:bg-accent-hover text-white shadow-sm"
                            }`}
                        >
                            {confirmText || "Confirm"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
