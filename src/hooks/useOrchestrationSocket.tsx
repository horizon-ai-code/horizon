"use client";

import { useRef, useCallback, useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { RefactorRequest, ServerMessage, StatusMessage, ResultMessage } from "@/types/websocket";
import type { TerminalEntry, SessionData, OrchestrationResult } from "@/types/session";
import { useChatStore } from "@/store/useChatStore";
import { EMPTY_ORCHESTRATION_RESULT } from "@/lib/constants";

// ── Role → Terminal Display Mapping ──────────────────────────────────────────
// Maps backend agent roles to the flowchart step index and terminal styling.
// The flowchart has 5 visual nodes, but the backend has 4 roles that produce
// 11+ status messages. We map roles to flowchart "regions" to keep the UI
// pipeline visualization meaningful.

interface RoleVisuals {
  step: number;
  icon: string;
  colorClass: string;
}

const ROLE_VISUALS: Record<string, RoleVisuals> = {
  Planner:   { step: 1, icon: "Cpu",          colorClass: "text-[#56a8f5]" },
  Generator: { step: 2, icon: "Layers",       colorClass: "text-[#2aacb8]" },
  Validator: { step: 3, icon: "FileCode2",    colorClass: "text-[#00e5ff]" },
  Judge:     { step: 4, icon: "CheckCircle2", colorClass: "text-[#27c93f]" },
  System:    { step: 1, icon: "Clock",        colorClass: "text-yellow-400" },
};

const DEFAULT_VISUALS: RoleVisuals = {
  step: 1,
  icon: "Cpu",
  colorClass: "text-jb-accent",
};

// ── Connection Status ────────────────────────────────────────────────────────

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

// ── Reconnect config ─────────────────────────────────────────────────────────

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface OrchestrationContextValue {
  connectionStatus: ConnectionStatus;
  connect: (targetSessionId: string) => void;
  disconnect: () => void;
  sendRefactorRequest: (request: RefactorRequest, commandId?: string) => boolean;
  sendHaltRequest: () => boolean;
  setTargetSessionId: (id: string) => void;
}

const OrchestrationContext = createContext<OrchestrationContextValue | null>(null);

export function OrchestrationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const intentionalCloseRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const lastProcessedCommandIdRef = useRef<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  const updateSession = useChatStore((s) => s.updateSession);
  const migrateSessionId = useChatStore((s) => s.migrateSessionId);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const makeTerminalEntry = (
    type: TerminalEntry["type"],
    text: string,
    icon?: string,
    colorClass?: string
  ): TerminalEntry => ({
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    text,
    icon,
    colorClass,
  });

  // ── Handle incoming status message ───────────────────────────────────────

  const handleStatus = useCallback(
    (msg: StatusMessage, targetId: string) => {
      const visuals = ROLE_VISUALS[msg.role] || DEFAULT_VISUALS;

      const entry = makeTerminalEntry(
        "log",
        `[${msg.role}]: ${msg.content}`,
        visuals.icon,
        visuals.colorClass
      );

      updateSession(targetId, (prev: SessionData) => {
        let appState = prev.appState;
        
        if (msg.role === "System") {
          if (msg.content.toLowerCase().includes("busy") || msg.content.toLowerCase().includes("queue")) {
            appState = "waiting";
          } else if (msg.content.toLowerCase().includes("halted")) {
            appState = "idle";
          }
        } else if (appState === "waiting" || appState === "idle") {
          // Transition to analyzing when we get the first agent message
          appState = "analyzing";
        }

        return {
          appState,
          activeStep: msg.role === "System" 
            ? Math.max(prev.activeStep, visuals.step) 
            : visuals.step,
          terminalEntries: [...prev.terminalEntries, entry],
        };
      });
    },
    [updateSession]
  );

  // ── Handle incoming result message ───────────────────────────────────────

  const handleResult = useCallback(
    (msg: ResultMessage, targetId: string) => {
      const doneEntry = makeTerminalEntry(
        "log",
        "[System]: Refactoring cycle complete. Output ready.",
        "CheckCircle2",
        "text-[#27c93f]"
      );

      const orchestrationResult: OrchestrationResult = {
        ...EMPTY_ORCHESTRATION_RESULT,
        summary: msg.insights,
        original_complexity: msg.original_complexity,
        refactored_complexity: msg.refactored_complexity,
        insights: msg.insights,
        performance: msg.performance,
        metrics: buildMetrics(msg.original_complexity, msg.refactored_complexity, msg.performance),
      };

      updateSession(targetId, (prev: SessionData) => ({
        activeStep: 5,
        terminalEntries: [...prev.terminalEntries, doneEntry],
        refactoredOutput: msg.code,
        orchestrationResult,
        appState: "done" as const,
        showFlowchartModal: false,
      }));
    },
    [updateSession]
  );

  // ── Handle incoming error message ────────────────────────────────────────

  const handleError = useCallback(
    (msg: ServerMessage & { type: "error" }, targetId: string) => {
      let errorText: string;

      if (typeof msg.details === "string") {
        // Malformed JSON error
        errorText = `${msg.message}: ${msg.details}`;
      } else if (Array.isArray(msg.details)) {
        // Validation error
        const fieldErrors = msg.details
          .map((d) => `${d.loc.join(".")}: ${d.msg}`)
          .join("; ");
        errorText = `${msg.message} — ${fieldErrors}`;
      } else {
        errorText = msg.message ?? "Unknown server error";
      }

      const entry = makeTerminalEntry("error", errorText);

      updateSession(targetId, (prev: SessionData) => ({
        terminalEntries: [...prev.terminalEntries, entry],
        appState: "idle" as const,
        showFlowchartModal: false,
      }));
    },
    [updateSession]
  );

  // ── Connect ──────────────────────────────────────────────────────────────

  const connect = useCallback(function doConnect(targetSessionId?: string) {
    if (targetSessionId) {
      sessionIdRef.current = targetSessionId;
    }

    // Prevent duplicate connections
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    clearReconnectTimer();
    intentionalCloseRef.current = false;
    setConnectionStatus("connecting");

    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      backoffRef.current = INITIAL_BACKOFF_MS;
      // Reset command tracking on fresh connection to allow re-sending if needed
      lastProcessedCommandIdRef.current = null;
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        const targetId = sessionIdRef.current;
        if (!targetId) return;

        switch (msg.type) {
          case "connection_id":
            if (targetId === "draft" && msg.id) {
                const store = useChatStore.getState();
                store.createSession(msg.id, {
                  ...store.draftSession,
                  id: msg.id,
                });
                store.resetDraftSession();
                sessionIdRef.current = msg.id;
                router.replace(`/${msg.id}`);
            } else if (msg.id && msg.id !== targetId) {
                migrateSessionId(targetId, msg.id);
                sessionIdRef.current = msg.id;
                router.replace(`/${msg.id}`);
            }
            break;
          case "status":
            handleStatus(msg as StatusMessage, targetId);
            break;
          case "result":
            handleResult(msg as ResultMessage, targetId);
            break;
          case "error":
            handleError(msg as ServerMessage & { type: "error" }, targetId);
            break;
          default:
            console.warn("[WS] Unknown message type:", msg);
        }
      } catch (err) {
        console.error("[WS] Failed to parse incoming message:", err);
      }
    };

    ws.onerror = () => {
      setConnectionStatus("error");
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      wsRef.current = null;

      // Auto-reconnect with exponential backoff (unless intentionally closed)
      if (!intentionalCloseRef.current) {
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
        reconnectTimerRef.current = setTimeout(() => {
          doConnect();
        }, delay);
      }
    };
  }, [clearReconnectTimer, handleStatus, handleResult, handleError, migrateSessionId, router]);

  // ── Disconnect ───────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus("disconnected");
  }, [clearReconnectTimer]);

  // ── Send a refactor request ──────────────────────────────────────────────

  const sendRefactorRequest = useCallback(
    (request: RefactorRequest, commandId?: string): boolean => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[WS] Cannot send — WebSocket is not open.");
        return false;
      }

      // Prevent duplicate sends for the same logical command across route changes
      if (commandId && lastProcessedCommandIdRef.current === commandId) {
        return true; // Already sent/acknowledged
      }

      wsRef.current.send(JSON.stringify(request));
      if (commandId) {
        lastProcessedCommandIdRef.current = commandId;
      }
      return true;
    },
    []
  );

  const sendHaltRequest = useCallback((): boolean => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[WS] Cannot halt — WebSocket is not open.");
      return false;
    }

    wsRef.current.send(JSON.stringify({ type: "halt" }));
    return true;
  }, []);

  // ── Keep sessionId available via ref for onmessage handler ───────────────

  const setTargetSessionId = useCallback((id: string) => {
    sessionIdRef.current = id;
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer]);

  return (
    <OrchestrationContext.Provider
      value={{
        connectionStatus,
        connect,
        disconnect,
        sendRefactorRequest,
        sendHaltRequest,
        setTargetSessionId,
      }}
    >
      {children}
    </OrchestrationContext.Provider>
  );
}

export function useOrchestrationSocket(): OrchestrationContextValue {
  const ctx = useContext(OrchestrationContext);
  if (!ctx) {
    throw new Error("useOrchestrationSocket must be used within an OrchestrationProvider");
  }
  return ctx;
}

// ── Utility: Build InsightMetric[] from Backend Stats ─────────────────────────

function buildMetrics(
  original_complexity: number | null,
  refactored_complexity: number | null,
  performance?: ResultMessage["performance"]
) {
  const metrics = [];

  if (refactored_complexity !== null) {
    metrics.push({
      title: "Cyclomatic Complexity",
      before: original_complexity !== null ? `${original_complexity}` : "—",
      after: `${refactored_complexity}`,
      direction:
        original_complexity !== null
          ? refactored_complexity < original_complexity
            ? ("down" as const)
            : refactored_complexity > original_complexity
            ? ("up" as const)
            : ("neutral" as const)
          : refactored_complexity <= 5
          ? ("down" as const)
          : ("up" as const),
      iconKey: "CheckCircle",
    });
  }

  if (performance) {
    const memUsed = performance.avg_gpu_memory_used ?? 0;
    const memPercent = performance.avg_gpu_memory ?? 0;
    const gpuUtil = performance.avg_gpu_utilization ?? 0;
    const infTime = performance.inference_time ?? 0;

    metrics.push({
      title: "Inference Time",
      before: "—",
      after: `${infTime}s`,
      direction: "neutral" as const,
      iconKey: "Clock",
    });

    metrics.push({
      title: "Avg GPU Utilization",
      before: "—",
      after: `${gpuUtil}%`,
      direction: "neutral" as const,
      iconKey: "Cpu",
    });

    metrics.push({
      title: "Avg GPU Memory",
      before: "—",
      after: `${(memUsed / (1024 * 1024 * 1024)).toFixed(2)} GB (${memPercent}%)`,
      direction: "neutral" as const,
      iconKey: "Layers",
    });
  }

  return metrics;
}
