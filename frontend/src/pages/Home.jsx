import React, { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Upload, Sun, Moon } from "lucide-react";
import DocumentsTab from "../components/DocumentsTab";
import ChatsTab from "../components/ChatsTab";
import ChatArea from "../components/ChatArea";
import PreviewPanel from "../components/PreviewPanel";
import UploadDialog from "../components/UploadDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import { getFiles, uploadDocument } from "../services/api";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "../contexts/ToastContext";

const Home = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Documents");
  const [files, setFiles] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [confirmDeleteChatId, setConfirmDeleteChatId] = useState(null);
  
  // Sidebar Resizing
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  
  const { theme, cycleTheme } = useTheme();
  const { addToast } = useToast();
  
  // Chat History Management
  const [chatSessions, setChatSessions] = useState(() => {
      try {
          const saved = localStorage.getItem("askmydocs_chats");
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });
  const [activeSessionId, setActiveSessionId] = useState(null);
  const activeSessionIdRef = useRef(activeSessionId);
  const selectedDocIdsRef = useRef(selectedDocIds);
  
  // Sync refs with state
  useEffect(() => {
      activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
      selectedDocIdsRef.current = selectedDocIds;
  }, [selectedDocIds]);
  
  // Update local storage when sessions change
  useEffect(() => {
      localStorage.setItem("askmydocs_chats", JSON.stringify(chatSessions));
  }, [chatSessions]);

  // Get current active history
  const activeHistory = activeSessionId 
      ? (chatSessions.find(s => s.id === activeSessionId)?.history || [])
      : [];

  const handleSetChatHistory = useCallback((updater) => {
      let currentSessionId = activeSessionIdRef.current;
      
      if (!currentSessionId) {
          // Creating a new session on first message
          const newId = Date.now().toString();
          activeSessionIdRef.current = newId;
          setActiveSessionId(newId);
          setActiveTab("Chats"); // Auto-switch sidebar to Chats tab
          
          setChatSessions(prev => {
              const newHistory = typeof updater === 'function' ? updater([]) : updater;
              const newSession = {
                  id: newId,
                  title: "New Chat",
                  date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  history: newHistory,
                  docIds: selectedDocIdsRef.current
              };
              
              // Auto-title from first user message
              if (newHistory.length > 0) {
                  const firstUserMsg = newHistory.find(m => m.role === 'user');
                  if (firstUserMsg) {
                      newSession.title = firstUserMsg.content.length > 40 
                          ? firstUserMsg.content.substring(0, 40) + "..." 
                          : firstUserMsg.content;
                  }
              }
              return [newSession, ...prev];
          });
          return;
      }

      setChatSessions(prev => {
          const currentSession = prev.find(s => s.id === currentSessionId);
          if (!currentSession) return prev;
          
          const newHistory = typeof updater === 'function' ? updater(currentSession.history) : updater;
          const updatedSession = { ...currentSession, history: newHistory };
          
          return prev.map(s => s.id === currentSessionId ? updatedSession : s);
      });
  }, []);

  const handleNewChat = () => {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleSelectSession = (id) => {
      setActiveSessionId(id);
      activeSessionIdRef.current = id;
      const session = chatSessions.find(s => s.id === id);
      if (session && session.docIds) {
          setSelectedDocIds(session.docIds);
      }
      if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const handleDeleteSession = (id) => {
      setConfirmDeleteChatId(id);
  };

  const confirmDeleteChat = () => {
      if (confirmDeleteChatId) {
          setChatSessions(prev => prev.filter(s => s.id !== confirmDeleteChatId));
          if (activeSessionId === confirmDeleteChatId) {
              setActiveSessionId(null);
              activeSessionIdRef.current = null;
          }
          addToast("Chat deleted", "info");
      }
  };

  const handleRenameSession = (id, newTitle) => {
      setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };
  
  const fetchFiles = async () => {
    try {
      const res = await getFiles();
      setFiles(res.data);
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    const hasPendingFiles = files.some(f => f.status === "queued" || f.status === "processing" || (typeof f.status === 'string' && f.status.startsWith('page')));
    if (!hasPendingFiles) return;
    const interval = setInterval(() => fetchFiles(), 2000);
    return () => clearInterval(interval);
  }, [files]);

  const handleDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
      e.preventDefault();
      setIsDragging(false);
  };
  
  const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      setUploadModalOpen(true);
      setTimeout(() => {
          const event = new CustomEvent('globalFileDrop', { detail: e.dataTransfer.files });
          window.dispatchEvent(event);
      }, 100);
  };

  useEffect(() => {
      if (!isResizing) return;
      const handleMouseMove = (e) => {
          let newWidth = e.clientX;
          if (newWidth < 200) newWidth = 200;
          if (newWidth > 600) newWidth = 600;
          setSidebarWidth(newWidth);
      };
      const handleMouseUp = () => setIsResizing(false);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isResizing]);

  return (
    <div 
        className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-bg text-text relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ cursor: isResizing ? 'col-resize' : undefined }}
    >
      {isDragging && (
          <div className="absolute inset-0 z-50 bg-surface/90 flex items-center justify-center">
              <div className="w-[400px] h-[200px] border-2 border-dashed border-accent flex flex-col items-center justify-center bg-bg text-accent rounded-lg">
                  <Upload size={32} className="mb-4" />
                  <span className="font-medium text-lg">Drop files to upload</span>
              </div>
          </div>
      )}
      <UploadDialog 
          isOpen={uploadModalOpen} 
          onClose={() => setUploadModalOpen(false)} 
          onUpload={async (formData) => {
              await uploadDocument(formData);
              fetchFiles();
              addToast("File uploaded", "success");
          }} 
      />
      {/* Top Bar */}
      <header className="flex-none h-14 border-b border-border bg-surface/80 backdrop-blur-md flex items-center justify-between px-4 z-40 transition-colors shadow-sm relative">
         <div className="flex items-center gap-3">
             <button className="lg:hidden p-1.5 text-text-2 hover:text-text -ml-1.5 rounded-md hover:bg-black/5" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
                 <Menu size={20} />
             </button>
             
             {/* Logo Mark */}
             <div className="flex items-center gap-2.5">
                 <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-hover rounded-lg flex items-center justify-center shrink-0 shadow-md ring-1 ring-accent/20">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" fill="white"/>
                         <path d="M14 2V8H20" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" strokeLinecap="square"/>
                     </svg>
                 </div>
                 <div className="font-sans font-semibold text-[16px] tracking-tight">AskMyDocs</div>
             </div>
         </div>
         
         <div className="flex items-center gap-2">
             <button 
                 onClick={cycleTheme}
                 className="p-2 text-text-2 hover:text-text rounded-md hover:bg-black/5 transition-colors group relative"
                 aria-label="Toggle theme"
             >
                 {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                 <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-text text-surface text-[12px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                     {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                 </span>
             </button>
         </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 overflow-hidden relative">
          
          {/* Left Sidebar */}
          <aside className={`
              absolute lg:static top-0 left-0 h-full bg-sidebar border-r border-border
              transition-transform duration-200 z-30 lg:transition-none
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
              flex flex-col shrink-0
          `}
          style={{ width: sidebarWidth }}>
              <div className="flex p-2 gap-1 border-b border-border">
                  <button onClick={() => setActiveTab("Documents")} className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'Documents' ? 'bg-surface shadow-sm text-text' : 'text-text-2 hover:bg-black/5'}`}>Documents</button>
                  <button onClick={() => setActiveTab("Chats")} className={`flex-1 py-1.5 px-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'Chats' ? 'bg-surface shadow-sm text-text' : 'text-text-2 hover:bg-black/5'}`}>Chats</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === 'Documents' ? (
                      <DocumentsTab 
                          files={files}
                          setFiles={setFiles}
                          selectedDocIds={selectedDocIds}
                          setSelectedDocIds={setSelectedDocIds}
                          onUploadClick={() => setUploadModalOpen(true)}
                      />
                  ) : (
                      <ChatsTab 
                          chatSessions={chatSessions}
                          activeSessionId={activeSessionId}
                          onSelectSession={handleSelectSession}
                          onNewChat={handleNewChat}
                          onDeleteSession={handleDeleteSession}
                          onRenameSession={handleRenameSession}
                      />
                  )}
              </div>
              <div 
                  className="hidden lg:block absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-accent/20 active:bg-accent/40 z-50 transition-colors"
                  onMouseDown={() => setIsResizing(true)}
              />
          </aside>

          {/* Overlay for mobile sidebar */}
          {sidebarOpen && (
              <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
          )}

          {/* Center Conversation */}
          <main className="flex-1 flex flex-col overflow-hidden bg-bg relative">
              <ChatArea 
                  key={activeSessionId || "new"}
                  selectedDocIds={selectedDocIds} 
                  files={files} 
                  chatHistory={activeHistory}
                  setChatHistory={handleSetChatHistory}
                  onUploadClick={() => setUploadModalOpen(true)}
                  onOpenSourcePreview={(src) => {
                      setActiveSource(src);
                      setRightPanelOpen(true);
                  }} 
              />
          </main>

          {/* Right Panel */}
          {rightPanelOpen && (
              <PreviewPanel 
                  source={activeSource} 
                  files={files} 
                  onClose={() => setRightPanelOpen(false)} 
              />
          )}
          
      </div>

      <ConfirmDialog 
          isOpen={!!confirmDeleteChatId}
          title="Delete Chat"
          message="Are you sure you want to delete this chat history? This cannot be undone."
          confirmText="Delete"
          isDanger={true}
          onClose={() => setConfirmDeleteChatId(null)}
          onConfirm={confirmDeleteChat}
      />
    </div>
  );
};

export default Home;
