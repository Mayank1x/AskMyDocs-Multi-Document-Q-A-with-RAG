import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, message, type }]);
        
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-4 left-4 z-[200] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id}
                        className="bg-surface border border-border shadow-md rounded-md p-3 flex items-center gap-3 w-72 pointer-events-auto transition-all animate-slide-up"
                    >
                        {toast.type === 'success' && <CheckCircle2 size={16} className="text-success shrink-0" />}
                        {toast.type === 'error' && <AlertCircle size={16} className="text-danger shrink-0" />}
                        {toast.type === 'info' && <Info size={16} className="text-accent shrink-0" />}
                        
                        <span className="text-[14px] font-medium text-text">{toast.message}</span>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-up {
                    animation: slide-up 0.2s ease-out;
                }
            `}</style>
        </ToastContext.Provider>
    );
};
