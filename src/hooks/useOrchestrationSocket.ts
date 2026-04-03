"use client";

import { useRef, useCallback, useState, useEffect } from "react";
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
  Planner:   { step: 2, icon: "Cpu",          colorClass: "text-[#56a8f5]" },
  Generator: { step: 3, icon: "Layers",       colorClass: "text-[#2aacb8]" },
  Validator: { step: 4, icon: "AlertCircle",   colorClass: "text-[#cf8e6d]" },
  Judge:     { step: 4, icon: "CheckCircle2",  colorClass: "text-[#27c93f]" },
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

interface UseOrchestrationSocketOptions {
  sessionId: string | null;
}

export function useOrchestrationSocket({ sessionId }: UseOrchestrationSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const intentionalCloseRef = useRef(false);

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

      updateSession(targetId, (prev: SessionData) => ({
        activeStep: Math.max(prev.activeStep, visuals.step),
        terminalEntries: [...prev.terminalEntries, entry],
      }));
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

      // Build orchestration result from backend payload.
      // metrics and replaySteps are left empty — the backend doesn't provide
      // them in the same shape as the old mock. The insights string and
      // complexity object are stored for the InsightsPanel.
      const orchestrationResult: OrchestrationResult = {
        ...EMPTY_ORCHESTRATION_RESULT,
        summary: msg.insights,
        complexity: msg.complexity,
        insights: msg.insights,
        metrics: buildMetricsFromComplexity(msg.complexity),
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

  const connect = useCallback(function doConnect() {
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
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        const targetId = sessionIdRef.current;
        if (!targetId) return;

        switch (msg.type) {
          case "connection_id":
            if (msg.id && msg.id !== targetId) {
                migrateSessionId(targetId, msg.id);
                sessionIdRef.current = msg.id;
                window.history.replaceState(null, '', `/${msg.id}`);
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
  }, [clearReconnectTimer, handleStatus, handleResult, handleError, migrateSessionId]);

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
    (request: RefactorRequest) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[WS] Cannot send — WebSocket is not open.");
        return;
      }
      wsRef.current.send(JSON.stringify(request));
    },
    []
  );

  // ── Keep sessionId available via ref for onmessage handler ───────────────

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    sessionIdRef.current = sessionId;
  }, [sessionId]);

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

  return {
    connectionStatus,
    connect,
    disconnect,
    sendRefactorRequest,
  };
}

// ── Utility: Build InsightMetric[] from ComplexityResult ──────────────────────
// The backend returns a flat complexity object rather than the array of metrics
// the old mock used. We transform it into something the InsightsPanel can render.

function buildMetricsFromComplexity(complexity: number | null) {
  const metrics = [];

  if (complexity !== null) {
    metrics.push({
      title: "Cyclomatic Complexity",
      before: "—",
      after: `${complexity}`,
      direction: complexity <= 5 ? ("down" as const) : ("up" as const),
      iconKey: "CheckCircle",
    });
  }

  return metrics;
}
