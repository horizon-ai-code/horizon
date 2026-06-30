"use client";

import React, { useMemo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "@xyflow/react";
import dagre from "@dagrejs/dagre";
import "@xyflow/react/dist/style.css";

import FlowNodeComponent from "./FlowNodeComponent";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import type { GlassboxState } from "@/types/glassbox";

const nodeTypes = { phaseNode: FlowNodeComponent };

const NODE_WIDTH = 160;
const NODE_HEIGHT = 160;

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

function FlowGraph({ appState, exitStatus, glassboxState }: Props) {
  const isDone = appState === "done";

  const { nodes: builtNodes, edges: builtEdges } = useMemo(
    () => buildGraphState(glassboxState, appState, exitStatus),
    [glassboxState, appState, exitStatus],
  );

  const laidOutNodes = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });

    builtNodes.forEach((n) => {
      g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    });

    builtEdges.forEach((e) => {
      g.setEdge(e.source, e.target);
    });

    dagre.layout(g);

    return builtNodes.map((n) => {
      const pos = g.node(n.id);
      return {
        ...n,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    });
  }, [builtNodes, builtEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(laidOutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(builtEdges);

  useEffect(() => {
    setNodes(laidOutNodes);
    setEdges(builtEdges);
  }, [laidOutNodes, builtEdges, setNodes, setEdges]);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        minZoom={0.3}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
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
