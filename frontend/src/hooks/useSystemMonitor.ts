"use client";

import { useState, useEffect, useRef } from "react";
import type { SystemMetricsPayload } from "@/types/websocket";

const MAX_SAMPLES = 60;
const RECONNECT_DELAY = 3000;

function getWsUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8000/ws/system";
  const base = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
  return base.replace(/\/ws$/, "/ws/system");
}

export interface SystemMonitorState {
  systemMetrics: SystemMetricsPayload | null;
  samples: SystemMetricsPayload[];
  connected: boolean;
}

export function useSystemMonitor(): SystemMonitorState {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricsPayload | null>(null);
  const [samples, setSamples] = useState<SystemMetricsPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!active) return;

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) {
          ws.close();
          return;
        }
        setConnected(true);
      };

      ws.onclose = () => {
        if (!active) return;

        setConnected(false);
        setSystemMetrics(null);

        reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!active) return;

        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "system_metrics" && msg.metrics) {
            const m = msg.metrics as SystemMetricsPayload;
            setSystemMetrics(m);
            setSamples((prev) => {
              const next = [...prev, m];
              return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
            });
          }
        } catch {
          console.warn("[SystemMonitor] Failed to parse metrics message");
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { systemMetrics, samples, connected };
}
