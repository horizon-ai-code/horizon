"use client"

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface DeleteSessionDialogProps {
  isOpen: boolean;
  sessionTitle: string;
  isGenerating?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const springConfig = { type: "spring" as const, stiffness: 450, damping: 40, mass: 0.8 };

export default function DeleteSessionDialog({
  isOpen,
  sessionTitle,
  isGenerating = false,
  onCancel,
  onConfirm,
}: DeleteSessionDialogProps) {

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when dialog is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Dialog Panel */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            className="relative z-10 w-full max-w-[400px] mx-4 rounded-xl border border-jb-border/50 bg-jb-panel shadow-2xl shadow-black/40"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={springConfig}
          >
            {/* Content */}
            <div className="p-6">
              {/* Icon + Title row */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h2
                    id="delete-dialog-title"
                    className="text-[15px] font-semibold text-jb-text leading-tight"
                  >
                    Delete session?
                  </h2>
                  <p
                    id="delete-dialog-description"
                    className="text-[13px] text-jb-text-muted leading-relaxed"
                  >
                    {isGenerating ? (
                      <>
                        <span className="font-medium text-amber-400/90">&ldquo;{sessionTitle}&rdquo;</span>{" "}
                        is still generating. Deleting it will stop all active processes. This action cannot be undone.
                      </>
                    ) : (
                      <>
                        This will permanently delete{" "}
                        <span className="font-medium text-jb-text/80">&ldquo;{sessionTitle}&rdquo;</span>{" "}
                        and its outputs. This action cannot be undone.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-jb-border/30" />

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <button
                onClick={onCancel}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-jb-text-muted transition-colors duration-150 hover:text-jb-text hover:bg-white/[0.04] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-red-500/40"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
