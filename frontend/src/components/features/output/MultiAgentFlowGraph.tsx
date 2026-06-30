"use client";

import React, { useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FlowNodeComponent from "./FlowNodeComponent";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import type { GlassboxState } from "@/types/glassbox";

const nodeTypes = { phaseNode: FlowNodeComponent };

const GAP_X = 420;
const GAP_Y = 480;

const GRID_POSITIONS: Record<string, { x: number; y: number }> = {
  p1: { x: 0, y: 0 },
  p2: { x: GAP_X, y: 0 },
  p3: { x: GAP_X * 2, y: 0 },
  p4: { x: 0, y: GAP_Y },
  p5: { x: GAP_X, y: GAP_Y },
  p6: { x: GAP_X * 2, y: GAP_Y },
};

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

function FlowGraph({ appState, exitStatus, glassboxState }: Props) {
  const isDone = appState === "done";
  const reactFlowInstance = useReactFlow();
  const lastPhaseRef = useRef(0);
  const initializedRef = useRef(false);

  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => buildGraphState(glassboxState, appState, exitStatus),
    [glassboxState, appState, exitStatus],
  );

  const positionedNodes = useMemo(() =>
    builtNodes.map((n) => ({
      ...n,
      position: GRID_POSITIONS[n.id] || { x: 0, y: 0 },
    })),
  [builtNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(positionedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);

  useEffect(() => {
    setNodes(positionedNodes);
    setEdges(builtEdges);
  }, [positionedNodes, builtEdges, setNodes, setEdges]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
    });
  }, [reactFlowInstance]);

  useEffect(() => {
    const phase = glassboxState.currentPhase;
    if (phase < 1 || phase > 6 || phase === lastPhaseRef.current) return;
    lastPhaseRef.current = phase;

    const timer = setTimeout(() => {
      reactFlowInstance.fitView({
        nodes: [{ id: `p${phase}` }],
        padding: 0.35,
        duration: 400,
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [glassboxState.currentPhase, reactFlowInstance]);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        attributionPosition="bottom-left"
        minZoom={0.4}
        maxZoom={3}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#393b40" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={() => "#2b2d30"}
          style={{ background: "#1e1f22" }}
        />
      </ReactFlow>

      {isDone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium z-10">
          <span>
            Total:{" "}
            {glassboxState.totalDurationMs != null
              ? `${(glassboxState.totalDurationMs / 1000).toFixed(1)}s`
              : "—"}
          </span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Strategy: {glassboxState.strategyIteration}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Syntax Heals: {glassboxState.syntaxHealAttempt}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span className={exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"}>
            {exitStatus || "—"}
          </span>
        </div>
      )}
    </div>
  );
}

export default function MultiAgentFlowGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowGraph {...props} />
    </ReactFlowProvider>
  );
}
