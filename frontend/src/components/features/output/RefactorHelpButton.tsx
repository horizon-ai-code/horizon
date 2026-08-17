"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, FileCode, RefreshCw } from "lucide-react";
import { SLOW_INFERENCE_THRESHOLD_SECONDS } from "@/lib/utils/inferenceConstants";

interface RefactorHelpButtonProps {
  isDark: boolean;
  elapsedSeconds: number;
  sourceCodeLength: number;
  sourceCodeLines: number;
}

export default function RefactorHelpButton({
  isDark,
  elapsedSeconds,
  sourceCodeLength,
  sourceCodeLines,
}: RefactorHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const pillRef = useRef<HTMLButtonElement>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    pillRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  if (elapsedSeconds < SLOW_INFERENCE_THRESHOLD_SECONDS) return null;

  return (
    <div className="flex items-center mr-2">
      <button
        ref={pillRef}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`h-[24px] px-2.5 flex items-center gap-1.5 rounded-md border text-[11px] font-semibold cursor-pointer transition-all
          ${isDark
            ? "border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10"
            : "border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10"}`}
      >
        Taking longer?
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={closeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inference-help-title"
          >
            <div
              className={`absolute inset-0 backdrop-blur-sm ${
                isDark ? "bg-black/50" : "bg-black/30"
              }`}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-[420px] max-w-[90vw] rounded-2xl border shadow-2xl p-6 flex flex-col gap-4
                ${isDark
                  ? "bg-jb-bg border-jb-border"
                  : "bg-white border-[#dfdfdf]"}`}
            >
              <div className="flex items-center justify-between">
                <h2
                  id="inference-help-title"
                  className={`text-[15px] font-bold ${
                    isDark ? "text-gray-100" : "text-slate-800"
                  }`}
                >
                  Why is this taking long?
                </h2>
                <button
                  onClick={closeModal}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer transition-all
                    ${isDark
                      ? "border-jb-border text-jb-text-muted hover:bg-jb-border/40"
                      : "border-[#dfdfdf] text-[#818594] hover:bg-[#ebecf0]"}`}
                >
                  Got it
                </button>
              </div>

              <p
                className={`text-[12px] leading-relaxed ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                Started {elapsedSeconds}s ago. You can wait, or start a new run
                with a simpler scope.
              </p>

              <div className="flex flex-col gap-3 mt-1">
                <ReasonCard
                  isDark={isDark}
                  icon={<Cpu size={16} />}
                  title="Local model inference is naturally slow"
                  body="Horizon runs the model locally on a 4 GB GPU. Cloud APIs run on hundreds of GPUs in parallel — local inference is single-stream and inherently slower."
                />
                <ReasonCard
                  isDark={isDark}
                  icon={<RefreshCw size={16} />}
                  title="Multiple iterations"
                  body="The pipeline may revisit and re-generate code across multiple rounds — strategy planning, syntax healing, and mutation retries each add time."
                />
                <ReasonCard
                  isDark={isDark}
                  icon={<FileCode size={16} />}
                  title="Code size"
                  body="Larger code = larger context for the model = more tokens to process per step."
                  rows={[
                    {
                      label: "Lines",
                      value: sourceCodeLines.toLocaleString(),
                    },
                    {
                      label: "Characters",
                      value: sourceCodeLength.toLocaleString(),
                    },
                  ]}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReasonCard({
  isDark,
  icon,
  title,
  body,
  rows,
}: {
  isDark: boolean;
  icon: React.ReactNode;
  title: string;
  body: string;
  rows?: { label: string; current?: number; max?: number; value?: string }[];
}) {
  return (
    <div
      className={`p-3.5 rounded-xl border flex flex-col gap-2
        ${isDark
          ? "bg-jb-panel border-jb-border"
          : "bg-[#f7f8fa] border-[#ebecf0]"}`}
    >
      <div className="flex items-center gap-2">
        <span className={isDark ? "text-amber-400" : "text-amber-600"}>
          {icon}
        </span>
        <span
          className={`text-[12px] font-bold ${
            isDark ? "text-gray-200" : "text-slate-800"
          }`}
        >
          {title}
        </span>
      </div>

      {rows && (
        <div className="flex flex-col gap-1 mt-0.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-2 text-[11px]"
            >
              <span
                className={`font-medium ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                {r.label}:
              </span>
              <span
                className={`font-semibold ${
                  isDark ? "text-gray-200" : "text-slate-700"
                }`}
              >
                {r.value
                  ? r.value
                  : `${r.current} / ${r.max}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <p
        className={`text-[11px] leading-relaxed ${
          isDark ? "text-gray-400" : "text-slate-500"
        }`}
      >
        {body}
      </p>
    </div>
  );
}
