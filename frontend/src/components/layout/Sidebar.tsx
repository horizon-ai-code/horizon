"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Plus, FileCode2, MoreVertical, Pencil, Trash, Check, X, AlertCircle } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useChatStore } from "@/store/useChatStore";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPRING_CONFIG = { type: "spring" as const, stiffness: 450, damping: 40, mass: 0.8 };

export default function Sidebar() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const params = useParams();
  const sessions = useChatStore((state) => state.sessions);
  const renameSession = useChatStore((state) => state.renameSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const fetchHistory = useChatStore((state) => state.fetchHistory);
  const historyLoadError = useChatStore((state) => state.historyLoadError);

  // ── Confirm Dialog State ──────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSessionId, setDialogSessionId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<"delete" | "leave" | "switch">("delete");
  const [switchTargetId, setSwitchTargetId] = useState<string | null>(null);

  const recentSessions = useMemo(() => Object.values(sessions)
    .filter(s => s && s.id && s.id !== 'draft')
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [sessions]);
  const activeId = typeof params.id === "string" ? params.id : "";
  const activeSession = activeId ? sessions[activeId] : undefined;
  const isActiveAnalyzing = activeSession?.appState === "analyzing";

  // Resolve dialog session title for display
  const dialogSessionTitle = dialogSessionId
    ? sessions[dialogSessionId]?.title ?? "this session"
    : "this session";

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!editingSessionId) return;

    const focusId = requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });

    return () => cancelAnimationFrame(focusId);
  }, [editingSessionId]);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  // ── Rename Helpers ──────────────────────────────────────────────────────────
  const startInlineRename = (sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditValue(currentTitle);
  };

  const cancelInlineRename = useCallback(() => {
    setEditingSessionId(null);
    setEditValue("");
  }, []);

  const saveInlineRename = (sessionId: string) => {
    const trimmed = editValue.trim();
    if (trimmed) {
      renameSession(sessionId, trimmed);
    }
    cancelInlineRename();
  };

  // ── Dialog Helpers ──────────────────────────────────────────────────────────
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogSessionId(null);
    setSwitchTargetId(null);
  }, []);

  const openDialog = useCallback(
    (action: "delete" | "leave" | "switch", sessionId: string, switchTo?: string) => {
      setDialogAction(action);
      setDialogSessionId(sessionId);
      setSwitchTargetId(switchTo ?? null);
      setDialogOpen(true);
    },
    []
  );

  const handleDialogConfirm = useCallback(async () => {
    if (!dialogSessionId) return;

    if (dialogAction === "delete") {
      await deleteSession(dialogSessionId);
      if (editingSessionId === dialogSessionId) {
        cancelInlineRename();
      }
      if (activeId === dialogSessionId) {
        router.push("/");
      }
    } else if (dialogAction === "leave") {
      if (editingSessionId) {
        cancelInlineRename();
      }
      router.push("/");
    } else if (dialogAction === "switch" && switchTargetId) {
      router.push(`/${switchTargetId}`);
    }

    closeDialog();
  }, [
    dialogSessionId,
    dialogAction,
    switchTargetId,
    activeId,
    editingSessionId,
    deleteSession,
    router,
    cancelInlineRename,
    closeDialog
  ]);

  // ── Navigation Helpers ──────────────────────────────────────────────────────
  const handleNewSession = () => {
    if (isActiveAnalyzing) {
      openDialog("leave", activeId);
      return;
    }

    if (editingSessionId) {
      cancelInlineRename();
    }

    router.push(`/`);
  };

  return (
    <motion.aside
      id="tour-sidebar"
      initial={false}
      animate={{ width: isOpen ? 240 : 48 }}
      transition={SPRING_CONFIG}
      className={`shrink-0 border-r flex flex-col z-20 h-full overflow-hidden
      ${isDark ? 'border-jb-border/40 bg-jb-panel' : 'border-[#ebecf0] bg-[#f7f8fa]'}`}
    >
      
      {/* Top Menu Icon Corner - Aligns with Navbar Height */}
      <div className={`h-[44px] w-full flex items-center justify-start px-2 shrink-0 transition-colors duration-300 cursor-pointer`}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
          className={`p-2 rounded-md transition-colors cursor-pointer shrink-0
          ${isDark ? 'text-jb-text opacity-80 hover:bg-[#3e4045] hover:opacity-100' : 'text-[#080808] opacity-70 hover:bg-[#ebecf0] hover:opacity-100'}`}>
          <Menu size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Main Sidebar Area */}
      <div className={`flex flex-col w-full px-2 py-4 gap-2 flex-1 min-h-0 overflow-y-auto custom-chat-scrollbar overflow-x-hidden border-b
        ${isDark ? 'border-jb-border/20' : 'border-[#ebecf0]/60'}`}>
        
        {/* New Session Button */}
        <button 
          onClick={handleNewSession}
          aria-label="New Session"
          className={`w-full flex items-center gap-3 p-2 rounded-md transition-all duration-200 active:scale-[0.98]
            justify-start
            ${isDark 
              ? 'bg-[#3574f0]/10 text-[#3574f0] hover:bg-[#3574f0]/20 hover:ring-1 hover:ring-white/[0.05]' 
              : 'bg-[#3574f0]/10 text-[#3574f0] hover:bg-[#3574f0]/20 hover:ring-1 hover:ring-black/[0.05]'
            }`}
        >
           <span className="w-[18px] h-[18px] shrink-0 flex items-center justify-center">
             <Plus size={18} strokeWidth={2} className="shrink-0" />
           </span>
           <AnimatePresence>
             {isOpen && (
               <motion.span
                 initial={{ opacity: 0, filter: "blur(4px)" }}
                 animate={{ opacity: 1, filter: "blur(0px)" }}
                 exit={{ opacity: 0, filter: "blur(4px)" }}
                 transition={SPRING_CONFIG}
                 className="text-[13px] font-medium whitespace-nowrap"
               >
                 New Session
               </motion.span>
             )}
           </AnimatePresence>
        </button>

        {/* Sessions List - Only visible when open */}
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_CONFIG}
              className="flex flex-col gap-1 mt-2"
            >
               <div className={`px-2 py-1 text-[11px] font-medium uppercase tracking-wider ${isDark ? 'text-jb-text/50' : 'text-[#818594]'}`}>
                  Recent
                </div>

                {historyLoadError && (
                  <div className={`flex items-center gap-2 px-2 py-2 rounded-md text-[11px] ${isDark ? 'bg-yellow-500/10 text-yellow-400' : 'bg-yellow-50 text-yellow-600'}`}>
                    <AlertCircle size={12} className="shrink-0" />
                    <span className="flex-1">Failed to load sessions</span>
                    <button
                      onClick={fetchHistory}
                      className="font-semibold underline hover:no-underline cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {recentSessions.map((session) => {
                  const isEditing = editingSessionId === session.id;

                  return (
                  <div 
                     key={session.id}
                     role="button"
                     tabIndex={0}
                     aria-label={`Session: ${session.title}`}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' || e.key === ' ') {
                         e.preventDefault();
                         if (isEditing) return;
                         if (isActiveAnalyzing && activeId === session.id) {
                           return;
                         }
                         if (isActiveAnalyzing && activeId && activeId !== session.id) {
                           openDialog("switch", activeId, session.id);
                           return;
                         }
                         router.push(`/${session.id}`);
                       }
                     }}
                     className={`group w-full flex items-center gap-3 p-2 rounded-md transition-all duration-200 cursor-pointer active:scale-[0.98] relative
                       justify-start
                       ${activeId === session.id ? (isDark ? 'bg-[#3e4045] text-jb-text ring-1 ring-white/[0.05]' : 'bg-[#ebecf0] text-[#080808] ring-1 ring-black/[0.05]') : ''}
                       ${isDark 
                         ? 'text-jb-text/70 hover:bg-[#3e4045] hover:text-jb-text hover:ring-1 hover:ring-white/[0.05]' 
                         : 'text-[#080808]/70 hover:bg-[#ebecf0] hover:text-[#080808] hover:ring-1 hover:ring-black/[0.05]'
                       }`}
                     onClick={() => {
                       if (isEditing) return;

                       if (isActiveAnalyzing && activeId === session.id) {
                         return;
                       }

                       if (isActiveAnalyzing && activeId && activeId !== session.id) {
                         openDialog("switch", activeId, session.id);
                         return;
                       }

                       router.push(`/${session.id}`);
                     }}
                  >
                   <FileCode2 size={18} strokeWidth={1.5} className="shrink-0" />
                   <div className="flex items-center gap-2 min-w-0 flex-1">
                     {isEditing ? (
                       <input
                         ref={editInputRef}
                         type="text"
                         value={editValue}
                         onChange={(e) => setEditValue(e.target.value)}
                         onClick={(e) => e.stopPropagation()}
                         onBlur={cancelInlineRename}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveInlineRename(session.id);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelInlineRename();
                            }
                          }}
                         autoFocus
                         className={`w-full min-w-0 bg-transparent text-[13px] text-left outline-none border-0 border-b px-0.5 py-0.5 ${isDark ? 'border-jb-border text-jb-text' : 'border-[#d4d8e0] text-[#080808]'} focus:ring-1 focus:ring-cyan-500/50 rounded-sm`}
                       />
                     ) : (
                       <span className="text-[13px] text-ellipsis overflow-hidden w-full text-left whitespace-nowrap">
                         {session.title}
                       </span>
                     )}
                   </div>

                   {isEditing ? (
                     <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                       <button
                         onClick={() => saveInlineRename(session.id)}
                         onMouseDown={(e) => e.preventDefault()}
                         disabled={!editValue.trim()}
                         className={`p-1 rounded-md transition-colors ${editValue.trim() ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-400/40 cursor-not-allowed'}`}
                         aria-label="Save rename"
                       >
                         <Check size={16} />
                       </button>
                       <button
                         onClick={cancelInlineRename}
                         onMouseDown={(e) => e.preventDefault()}
                         className={`p-1 rounded-md transition-colors ${isDark ? 'text-jb-text/60 hover:text-jb-text hover:bg-black/20' : 'text-[#080808]/60 hover:text-[#080808] hover:bg-black/5'}`}
                         aria-label="Cancel rename"
                       >
                         <X size={16} />
                       </button>
                     </div>
                   ) : (
                     <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                       <DropdownMenu>
                         <DropdownMenuTrigger className={`p-1 rounded-md outline-none transition-colors ${isDark ? 'hover:bg-black/20 text-jb-text/70 hover:text-jb-text' : 'hover:bg-black/5 text-[#080808]/70 hover:text-[#080808]'}`}>
                           <MoreVertical size={14} />
                         </DropdownMenuTrigger>
                         <DropdownMenuContent 
                           align="end" 
                           className={`w-40 border-0 shadow-xl ${isDark ? 'bg-[#2b2d30] text-jb-text' : 'bg-white text-[#080808] shadow-slate-200/50'}`}
                         >
                           <DropdownMenuItem
                             className={`gap-2 cursor-pointer ${isDark ? 'focus:bg-[#3e4045]' : ''}`}
                             onClick={() => startInlineRename(session.id, session.title)}
                           >
                             <Pencil size={14} />
                             <span>Rename</span>
                           </DropdownMenuItem>
                           <DropdownMenuItem
                             className="gap-2 text-red-500 focus:text-red-500 cursor-pointer focus:bg-red-500/10"
                             onClick={(e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               // Small timeout to escape the dropdown's focus/unmount cycle
                               setTimeout(() => openDialog("delete", session.id), 0);
                             }}
                           >
                             <Trash size={14} />
                             <span>Delete</span>
                           </DropdownMenuItem>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </div>
                   )}
                </div>
               );
                })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete / Leave / Switch Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogAction === "delete" ? "Delete session?" : dialogAction === "leave" ? "Leave session?" : "Switch session?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogAction === "leave" || dialogAction === "switch" || (dialogAction === "delete" && isActiveAnalyzing && dialogSessionId === activeId) ? (
                <>
                  <span className="font-medium text-amber-400/90">&ldquo;{dialogSessionTitle}&rdquo;</span>{" "}
                  is still generating. Deleting it will stop all active processes. This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete{" "}
                  <span className="font-medium text-jb-text/80">&ldquo;{dialogSessionTitle}&rdquo;</span>{" "}
                  and its outputs. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDialogConfirm}>
              {dialogAction === "delete" ? "Delete" : dialogAction === "leave" ? "Leave" : "Switch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.aside>
  );
}
