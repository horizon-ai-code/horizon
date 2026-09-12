"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { ShieldCheck, HardDrive, Lock, ServerOff } from "lucide-react";

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onAcknowledge: () => void;
}

export default function PrivacyNoticeModal({
  isOpen,
  onAcknowledge,
}: PrivacyNoticeModalProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  // Auto-focus primary action button when modal opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsProcessing(false);
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Trap focus inside modal & intentionally intercept Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        // Prevent accidental closing on Escape as required
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Tab") {
        if (!modalContainerRef.current) return;
        const focusableElements = modalContainerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (isProcessing) return;
    setIsProcessing(true);
    onAcknowledge();
  }, [isProcessing, onAcknowledge]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="privacy-notice-title"
          aria-describedby="privacy-notice-description"
          onKeyDown={handleKeyDown}
        >
          {/* Backdrop with strong blur and dimming; clicking outside is disabled */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 select-none ${
              isDark ? "bg-black/75 backdrop-blur-md" : "bg-black/50 backdrop-blur-sm"
            }`}
          />

          {/* Modal Dialog Card */}
          <motion.div
            ref={modalContainerRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
              isDark
                ? "bg-jb-bg border-jb-border/80 text-jb-text shadow-black/70"
                : "bg-white border-[#dfdfdf] text-[#080808] shadow-2xl shadow-black/20"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`px-6 pt-6 pb-4 border-b shrink-0 flex items-start gap-3.5 ${
                isDark ? "border-jb-border/40 bg-jb-panel/30" : "border-[#ebecf0] bg-[#f8f9fa]"
              }`}
            >
              <div
                className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center border ${
                  isDark
                    ? "bg-jb-accent/10 border-jb-accent/30 text-jb-accent"
                    : "bg-[#3574f0]/10 border-[#3574f0]/30 text-[#3574f0]"
                }`}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase block mb-1 ${
                    isDark ? "text-jb-accent" : "text-[#3574f0]"
                  }`}
                >
                  Horizon AI Verification
                </span>
                <h2
                  id="privacy-notice-title"
                  className={`text-[17px] font-bold leading-snug ${
                    isDark ? "text-jb-text" : "text-[#080808]"
                  }`}
                >
                  PRIVACY & DATA PROCESSING NOTICE
                </h2>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div
              id="privacy-notice-description"
              className="flex-1 overflow-y-auto custom-chat-scrollbar px-6 py-5 space-y-4 text-[13px] leading-relaxed"
            >
              <p className={isDark ? "text-jb-text" : "text-[#333333]"}>
                Horizon AI is engineered with an{" "}
                <strong className={isDark ? "text-white" : "text-black"}>
                  offline-first architecture
                </strong>
                . Before continuing with your onboarding tour, please review how your source code
                and session data are processed locally.
              </p>

              {/* Informational Cards */}
              <div className="space-y-3 pt-1">
                <div
                  className={`p-3.5 rounded-xl border flex gap-3 items-start ${
                    isDark
                      ? "bg-jb-panel/60 border-jb-border/50"
                      : "bg-[#f7f8fa] border-[#ebecf0]"
                  }`}
                >
                  <ServerOff
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isDark ? "text-emerald-400" : "text-emerald-600"
                    }`}
                  />
                  <div>
                    <h4
                      className={`text-[12px] font-bold ${
                        isDark ? "text-gray-200" : "text-slate-800"
                      }`}
                    >
                      100% Local Multi-Agent Orchestration
                    </h4>
                    <p
                      className={`text-[12px] mt-1 leading-normal ${
                        isDark ? "text-jb-text-muted" : "text-[#666666]"
                      }`}
                    >
                      All model inference, multi-agent reasoning (Planner, Generator, Validator, and
                      Judge), and refactoring execution run entirely on your local machine.
                    </p>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex gap-3 items-start ${
                    isDark
                      ? "bg-jb-panel/60 border-jb-border/50"
                      : "bg-[#f7f8fa] border-[#ebecf0]"
                  }`}
                >
                  <Lock
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isDark ? "text-amber-400" : "text-amber-600"
                    }`}
                  />
                  <div>
                    <h4
                      className={`text-[12px] font-bold ${
                        isDark ? "text-gray-200" : "text-slate-800"
                      }`}
                    >
                      No External Cloud Code Transmission
                    </h4>
                    <p
                      className={`text-[12px] mt-1 leading-normal ${
                        isDark ? "text-jb-text-muted" : "text-[#666666]"
                      }`}
                    >
                      Your source code and refactor instructions are never uploaded to remote cloud
                      servers, telemetry collectors, or shared with third parties.
                    </p>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-xl border flex gap-3 items-start ${
                    isDark
                      ? "bg-jb-panel/60 border-jb-border/50"
                      : "bg-[#f7f8fa] border-[#ebecf0]"
                  }`}
                >
                  <HardDrive
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      isDark ? "text-sky-400" : "text-sky-600"
                    }`}
                  />
                  <div>
                    <h4
                      className={`text-[12px] font-bold ${
                        isDark ? "text-gray-200" : "text-slate-800"
                      }`}
                    >
                      Local Session & Telemetry Storage
                    </h4>
                    <p
                      className={`text-[12px] mt-1 leading-normal ${
                        isDark ? "text-jb-text-muted" : "text-[#666666]"
                      }`}
                    >
                      Session history, diff highlights, and terminal decision logs are stored on
                      your local workstation so you can inspect past runs at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div
              className={`px-6 py-4 border-t shrink-0 flex items-center justify-between gap-3 ${
                isDark ? "border-jb-border/40 bg-jb-panel/40" : "border-[#ebecf0] bg-[#f8f9fa]"
              }`}
            >
              <span
                className={`text-[11px] ${
                  isDark ? "text-jb-text-muted" : "text-[#777777]"
                }`}
              >
                Acknowledgement required for first launch
              </span>

              <button
                ref={primaryButtonRef}
                onClick={handleConfirm}
                disabled={isProcessing}
                className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jb-accent focus-visible:ring-offset-2 active:scale-[0.98] ${
                  isDark
                    ? "bg-jb-accent hover:bg-jb-accent/90 text-white shadow-md shadow-jb-accent/20"
                    : "bg-[#3574f0] hover:bg-[#3574f0]/90 text-white shadow-md shadow-[#3574f0]/20"
                } ${isProcessing ? "opacity-75 cursor-not-allowed" : ""}`}
                aria-label="I Understand & Continue"
              >
                {isProcessing ? "Starting Tour..." : "I Understand & Continue"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
