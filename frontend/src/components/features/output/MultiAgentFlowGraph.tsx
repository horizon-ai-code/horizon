"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import CircularNodeComponent from "./CircularNodeComponent";
import CustomCurvedEdge from "./CustomCurvedEdge";
import PhaseDetailDrawer from "./PhaseDetailDrawer";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import type { GlassboxState } from "@/types/glassbox";
import type { FlowNodeData, FlowEdgeData } from "@/types/flowGraph";
import { Maximize2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { circularNode: CircularNodeComponent as any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edgeTypes = { customCurvedEdge: CustomCurvedEdge as any };

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState?: GlassboxState;
  phaseStates?: Record<string, string>;
}

function InnerFlowGraph({ appState, exitStatus, glassboxState, phaseStates }: Props) {
  const { fitView } = useReactFlow();

  const fallbackGlassbox: GlassboxState = useMemo(
    () => ({
      currentPhase: 1,
      currentAgent: "System",
      strategyIteration: 1,
      maxStrategyIterations: 3,
      syntaxHealAttempt: 0,
      maxSyntaxHealAttempts: 3,
      sequentialMutationRetry: 0,
      maxSequentialMutationRetries: 3,
      validationFaultCount: null,
      judgeDecision: null,
      currentDetail: null,
      phaseSummaries: {},
      phaseDurations: [],
      totalDurationMs: null,
      phaseStates,
    }),
    [phaseStates]
  );

  const effectiveGlassbox = glassboxState || fallbackGlassbox;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphState(effectiveGlassbox, appState, exitStatus, selectedNodeId),
    [effectiveGlassbox, appState, exitStatus, selectedNodeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Directly sync ReactFlow state reactively on effectiveGlassbox changes in real time
  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = buildGraphState(
      effectiveGlassbox,
      appState,
      exitStatus,
      selectedNodeId
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [effectiveGlassbox, appState, exitStatus, selectedNodeId, setNodes, setEdges]);

  // Handle Node Click to open Detail Drawer
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    const found = nodes.find((n) => n.id === selectedNodeId);
    return (found?.data as FlowNodeData) || null;
  }, [selectedNodeId, nodes]);

  const handleRecenter = () => {
    fitView({ padding: 0.2, duration: 400 });
  };

  return (
    <div className="relative w-full h-full bg-jb-bg overflow-hidden select-none">
      {/* Top Banner Bar */}
      <div className="absolute top-3 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-jb-panel/80 border border-jb-border/40 text-[11px] font-medium backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-jb-text font-mono tracking-tight uppercase">Multi-Agent Flow Graph</span>
        <span className="text-jb-text-muted/40">|</span>
        <span className="text-jb-text-muted text-[10px]">Click a node to inspect details</span>
      </div>

      {/* Recenter & Controls Button */}
      <button
        onClick={handleRecenter}
        className="absolute top-3 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-jb-panel/80 hover:bg-jb-panel border border-jb-border/50 text-jb-text text-[11px] font-mono shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        title="Fit View"
      >
        <Maximize2 size={13} className="text-cyan-400" />
        <span>Fit View</span>
      </button>

      {/* React Flow Canvas */}
      <ReactFlow<Node<FlowNodeData>, Edge<FlowEdgeData>>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2b2d30" gap={24} size={1} />
        <Controls showInteractive={false} className="!bg-jb-panel/80 !border-jb-border/50 !rounded-lg" />
      </ReactFlow>

      {/* Slide-over Inspection Drawer */}
      <PhaseDetailDrawer nodeData={selectedNodeData} onClose={() => setSelectedNodeId(null)} />

      {/* Post-run / Live Summary Footer */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-1.5 rounded-full bg-jb-panel/90 border border-jb-border/60 text-[11px] font-mono backdrop-blur-md shadow-xl">
        <span className="text-jb-text-muted">
          Iteration: <strong className="text-cyan-400">{Math.min(effectiveGlassbox.strategyIteration, effectiveGlassbox.maxStrategyIterations || 3)}</strong>
        </span>
        {exitStatus && (
          <>
            <span className="w-px h-3 bg-jb-border/50" />
            <span className={`font-bold ${exitStatus === "SUCCESS" ? "text-emerald-400" : "text-red-400"}`}>
              {exitStatus}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default function MultiAgentFlowGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <InnerFlowGraph {...props} />
    </ReactFlowProvider>
  );
}
