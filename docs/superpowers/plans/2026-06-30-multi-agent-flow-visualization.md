# Multi-Agent Flow Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static 4-node flowchart with full React Flow directed graph showing all 6 phases, all possible edges, live path highlighting, and post-run recap.

**Architecture:** React Flow renders a top-to-bottom dagre layout of 6 phase nodes with forward, loop, and abort edges. GlassboxState from context drives node/edge states. New Flow tab in RefactoredOutput panel.

**Tech Stack:** `@xyflow/react`, `dagre`, React, TypeScript, Tailwind

---

### Task 1: Install Dependency & Create Types

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/types/flowGraph.ts`

- [ ] **Step 1: Install @xyflow/react**

Run: `npm install @xyflow/react @types/dagre`
Workdir: `frontend/`

Expected: packages added to `package.json` and `node_modules/`

- [ ] **Step 2: Create flowGraph types**

```typescript
// frontend/src/types/flowGraph.ts
import type { AgentRole } from "./glassbox";

export type NodeStatus = "waiting" | "active" | "done_ok" | "done_fail" | "skipped";
export type EdgeType = "forward" | "syntax_heal" | "structural_fix" | "strategy" | "abort";
export type EdgeStatus = "dimmed" | "active" | "done";

export interface PhaseMeta {
  num: number;
  name: string;
  agent: AgentRole;
  icon: string;
  color: string;
}

export interface FlowNodeData {
  phase: PhaseMeta;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
}

export interface FlowEdgeData {
  type: EdgeType;
  status: EdgeStatus;
  label?: string;
}

export interface FlowGraphState {
  nodes: import("@xyflow/react").Node<FlowNodeData>[];
  edges: import("@xyflow/react").Edge<FlowEdgeData>[];
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/flowGraph.ts
git commit -m "feat: add @xyflow/react dependency and flow graph types"
```

---

### Task 2: Create Phase Metadata & Graph Definitions

**Files:**
- Create: `frontend/src/lib/flowGraph/phases.ts`
- Create: `frontend/src/lib/flowGraph/edges.ts`

- [ ] **Step 1: Create phase metadata**

```typescript
// frontend/src/lib/flowGraph/phases.ts
import type { PhaseMeta } from "@/types/flowGraph";

export const PHASES: PhaseMeta[] = [
  { num: 1, name: "Baseline",     agent: "Validator", icon: "Layers",       color: "#5a8cf8" },
  { num: 2, name: "Strategy",     agent: "Planner",   icon: "Cpu",          color: "#56a8f5" },
  { num: 3, name: "Execution",    agent: "Generator", icon: "Zap",          color: "#3dd6c8" },
  { num: 4, name: "Validation",   agent: "Validator", icon: "FileCode2",    color: "#e09c3b" },
  { num: 5, name: "Adjudication", agent: "Judge",     icon: "CheckCircle2", color: "#4ec97e" },
  { num: 6, name: "Finalization", agent: "System",    icon: "Clock",        color: "#a78bfa" },
];

export const PHASE_BY_NUM = new Map(PHASES.map((p) => [p.num, p]));
export const PHASE_BY_AGENT = new Map(PHASES.map((p) => [p.agent, p]));
```

- [ ] **Step 2: Create static edge definitions**

```typescript
// frontend/src/lib/flowGraph/edges.ts
import type { EdgeType } from "@/types/flowGraph";

interface EdgeDef {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export const ALL_EDGES: EdgeDef[] = [
  // Forward (main pipeline)
  { id: "e1-2", source: "p1", target: "p2", type: "forward" },
  { id: "e2-3", source: "p2", target: "p3", type: "forward" },
  { id: "e3-4", source: "p3", target: "p4", type: "forward" },
  { id: "e4-5", source: "p4", target: "p5", type: "forward" },
  { id: "e5-6", source: "p5", target: "p6", type: "forward" },

  // Syntax heal (P3 → P3, self-loop)
  { id: "e3-3-heal", source: "p3", target: "p3", type: "syntax_heal", label: "Syntax Heal" },

  // Structural fix (P4 → P3)
  { id: "e4-3-fix", source: "p4", target: "p3", type: "structural_fix", label: "Structural Fix" },

  // Strategy revision (any → P2)
  { id: "e2-2-revise", source: "p2", target: "p2", type: "strategy", label: "Retry" },
  { id: "e3-2-revise", source: "p3", target: "p2", type: "strategy", label: "Revise Strategy" },
  { id: "e4-2-revise", source: "p4", target: "p2", type: "strategy", label: "Revise Strategy" },
  { id: "e5-2-revise", source: "p5", target: "p2", type: "strategy", label: "Revise Strategy" },

  // Abort (→ P6)
  { id: "e3-6-abort", source: "p3", target: "p6", type: "abort", label: "Abort" },
  { id: "e5-6-abort", source: "p5", target: "p6", type: "abort", label: "Abort" },
];
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/flowGraph/
git commit -m "feat: add phase metadata and edge definitions for flow graph"
```

---

### Task 3: Create GlassboxState → Graph State Mapper

**Files:**
- Create: `frontend/src/lib/flowGraph/buildGraphState.ts`

- [ ] **Step 1: Create buildGraphState function**

```typescript
// frontend/src/lib/flowGraph/buildGraphState.ts
import type { Node, Edge } from "@xyflow/react";
import type { GlassboxState } from "@/types/glassbox";
import type { FlowNodeData, FlowEdgeData, NodeStatus, EdgeStatus } from "@/types/flowGraph";
import { PHASES, PHASE_BY_NUM, PHASE_BY_AGENT } from "./phases";
import { ALL_EDGES } from "./edges";

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const { currentPhase, currentAgent, strategyIteration, syntaxHealAttempt,
          validationFaultCount, judgeDecision, phaseDurations } = glassboxState;
  const isDone = appState === "done";

  // Build nodes
  const nodes: Node<FlowNodeData>[] = PHASES.map((phase, i) => {
    let status: NodeStatus = "waiting";

    if (isDone) {
      // Determine final state based on exit status
      if (exitStatus === "SUCCESS") {
        status = "done_ok";
      } else if (phase.num === 6) {
        // P6 always runs, even on abort — but mark it based on exit
        status = exitStatus ? "done_fail" : "done_ok";
      } else if (currentPhase > 0 && phase.num < currentPhase) {
        // Phases before the abort point completed successfully
        status = "done_ok";
      } else if (phase.num === currentPhase) {
        // The phase where abort happened
        status = "done_fail";
      } else {
        status = "skipped";
      }
    } else {
      // Live: determine node status
      if (phase.num < currentPhase) {
        status = "done_ok";
      } else if (phase.num === currentPhase) {
        status = "active";
      } else {
        status = "waiting";
      }
    }

    const duration = phaseDurations.find((d) => d.phase === phase.num);

    return {
      id: `p${phase.num}`,
      type: "phaseNode",
      position: { x: 0, y: 0 }, // dagre computes layout
      data: {
        phase,
        status,
        iteration: phase.num === 2 ? strategyIteration :
                    phase.num === 3 ? Math.max(syntaxHealAttempt, 1) : 1,
        durationMs: duration?.durationMs ?? null,
        modelName: phase.agent === "Planner" ? glassboxState.plannerModel :
                    phase.agent === "Generator" ? glassboxState.generatorModel :
                    phase.agent === "Judge" ? glassboxState.judgeModel :
                    undefined,
      },
    };
  });

  // Build edges
  const edges: Edge<FlowEdgeData>[] = ALL_EDGES.map((edgeDef) => {
    let status: EdgeStatus = "dimmed";

    if (isDone) {
      // Post-run: traverse edges that were taken
      status = "dimmed"; // default, overridden below
    }

    return {
      id: edgeDef.id,
      source: edgeDef.source,
      target: edgeDef.target,
      type: "smoothstep",
      data: { type: edgeDef.type, status, label: edgeDef.label },
      style: getEdgeStyle(edgeDef.type, "dimmed"),
      animated: false,
    };
  });

  return { nodes, edges };
}

function getEdgeStyle(type: string, status: EdgeStatus): React.CSSProperties {
  const isActive = status === "active";
  const dimStyle: React.CSSProperties = { stroke: "#555", strokeWidth: 1.5, opacity: 0.2 };

  switch (type) {
    case "forward":
      return isActive
        ? { stroke: "#4ec97e", strokeWidth: 3, opacity: 1 }
        : { ...dimStyle, strokeWidth: 2, opacity: 0.3 };
    case "syntax_heal":
    case "structural_fix":
      return isActive
        ? { stroke: "#e09c3b", strokeWidth: 2.5, opacity: 1, strokeDasharray: "6 3" }
        : { ...dimStyle, strokeDasharray: "6 3" };
    case "strategy":
      return isActive
        ? { stroke: "#56a8f5", strokeWidth: 2, opacity: 1, strokeDasharray: "4 4" }
        : { ...dimStyle, strokeDasharray: "4 4" };
    case "abort":
      return isActive
        ? { stroke: "#f93e3e", strokeWidth: 2.5, opacity: 1 }
        : { ...dimStyle };
    default:
      return dimStyle;
  }
}
```

Note: The `React.CSSProperties` import needs to be added, but it's available via the React global types.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/flowGraph/buildGraphState.ts
git commit -m "feat: add GlassboxState → React Flow nodes/edges mapper"
```

---

### Task 4: Create MultiAgentFlowGraph Component

**Files:**
- Create: `frontend/src/components/features/output/MultiAgentFlowGraph.tsx`
- Create: `frontend/src/components/features/output/FlowNodeComponent.tsx`

- [ ] **Step 1: Create custom PhaseNode component**

```typescript
// frontend/src/components/features/output/FlowNodeComponent.tsx
"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { FlowNodeData, NodeStatus } from "@/types/flowGraph";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap,
};

function FlowNodeComponent({ data }: NodeProps<FlowNodeData>) {
  const { phase, status, iteration, durationMs, modelName } = data;
  const Icon = ICON_MAP[phase.icon] || Layers;

  const statusColors: Record<NodeStatus, { bg: string; ring: string; text: string }> = {
    waiting: { bg: "bg-jb-panel/30", ring: "ring-jb-border/30", text: "text-jb-text-muted/50" },
    active:  { bg: "bg-jb-bg", ring: "ring-jb-accent/50", text: "text-jb-accent" },
    done_ok: { bg: "bg-green-500/5", ring: "ring-green-500/40", text: "text-green-500" },
    done_fail: { bg: "bg-red-500/5", ring: "ring-red-500/40", text: "text-red-500" },
    skipped: { bg: "bg-jb-panel/20", ring: "ring-jb-border/20", text: "text-jb-text-muted/30" },
  };

  const c = statusColors[status];

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-40 h-40 rounded-[20px] ring-1 transition-all duration-500 ${c.bg} ${c.ring} ${c.text}`}>
      <Handle type="target" position={Position.Top} className="!bg-jb-border" />
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold opacity-60">P{phase.num}</span>
        {status === "active" && (
          <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
        )}
      </div>
      {Icon && <Icon size={26} className="mb-2" style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : "" }} />}
      <h4 className="text-[12px] font-bold text-center leading-tight">{phase.name}</h4>
      <span className="text-[9px] font-mono opacity-60">{phase.agent}</span>
      {modelName && (
        <span className="text-[8px] font-mono opacity-40 text-center leading-tight mt-0.5">{modelName}</span>
      )}
      {iteration > 1 && status !== "waiting" && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
          {iteration}
        </span>
      )}
      {durationMs !== null && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-jb-border/30 text-jb-text-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-jb-border" />
    </div>
  );
}

export default memo(FlowNodeComponent);
```

- [ ] **Step 2: Create MultiAgentFlowGraph component**

```typescript
// frontend/src/components/features/output/MultiAgentFlowGraph.tsx
"use client";

import React, { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FlowNodeComponent from "./FlowNodeComponent";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import type { GlassboxState } from "@/types/glassbox";
import { useOrchestrationSocket } from "@/hooks/useOrchestrationSocket";

const nodeTypes = { phaseNode: FlowNodeComponent };

interface Props {
  appState: string;
  exitStatus?: string;
}

function FlowGraph({ appState, exitStatus }: Props) {
  const { glassboxState } = useOrchestrationSocket();
  const isDone = appState === "done";

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphState(glassboxState, appState, exitStatus),
    [glassboxState, appState, exitStatus],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when glassboxState changes
  React.useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = buildGraphState(
      glassboxState, appState, exitStatus,
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [glassboxState, appState, exitStatus, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
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
      >
        <Background color="#393b40" gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as { status?: string } | undefined;
            if (!data?.status || data.status === "waiting") return "#2b2d30";
            if (data.status === "active") return "#3574f0";
            if (data.status === "done_ok") return "#27c93f";
            if (data.status === "done_fail") return "#f93e3e";
            return "#555";
          }}
          style={{ background: "#1e1f22" }}
        />
      </ReactFlow>
      {isDone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium">
          <span>Total: {glassboxState.totalDurationMs ? `${(glassboxState.totalDurationMs / 1000).toFixed(1)}s` : "—"}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Strategy: {glassboxState.strategyIteration}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Syntax Heals: {glassboxState.syntaxHealAttempt}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span className={`${exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"}`}>
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
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/features/output/MultiAgentFlowGraph.tsx frontend/src/components/features/output/FlowNodeComponent.tsx
git commit -m "feat: add MultiAgentFlowGraph component with React Flow"
```

---

### Task 5: Integrate Flow Tab into RefactoredOutput

**Files:**
- Modify: `frontend/src/components/features/output/RefactoredOutput.tsx`

- [ ] **Step 1: Add Flow tab alongside existing tabs**

Replace the type union and add the Flow button:

```typescript
// Change rightPanelMode type (line 42):
  const [rightPanelMode, setRightPanelMode] = useState<'output' | 'insights' | 'flow'>(
    appState === 'analyzing' ? 'flow' : 'output'
  );

// Add Flow button after the Inspects button (around line 93):
  <button 
    onClick={() => setRightPanelMode('flow')}
    role="tab"
    aria-selected={rightPanelMode === 'flow'}
    className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
      ${rightPanelMode === 'flow' 
        ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
        : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
  >
     Flow
  </button>
```

- [ ] **Step 2: Update conditional rendering for Flow tab**

Import MultiAgentFlowGraph:

```typescript
import MultiAgentFlowGraph from "./MultiAgentFlowGraph";
```

Replace the old OrchestrationFlowchart rendering in the conditional block (lines 157-158):

Remove:
```
) : appState === 'analyzing' ? (
  <OrchestrationFlowchart activeStep={activeStep} glassboxState={glassboxState} />
```

Replace with the Flow tab in the final else block. The new render logic becomes:

```typescript
{rightPanelMode === 'flow' ? (
  <MultiAgentFlowGraph
    appState={appState}
    exitStatus={orchestrationResult.exit_status}
  />
) : rightPanelMode === 'output' ? (
  <CodeEditorPanel ... />
) : (
  <InsightsPanel ... />
)}
```

The complete render block should look like:

```typescript
{appState === 'idle' ? (
  // ... existing idle placeholder
) : appState === 'waiting' ? (
  // ... existing waiting placeholder
) : appState === 'analyzing' && isMonolith ? (
  <CodeSkeleton sourceCode={sourceCode} />
) : appState === 'done' && !refactoredOutput?.trim() && rightPanelMode !== 'flow' ? (
  // ... existing interrupted placeholder (only when not on flow tab)
) : rightPanelMode === 'flow' ? (
  <MultiAgentFlowGraph
    appState={appState}
    exitStatus={orchestrationResult.exit_status}
  />
) : rightPanelMode === 'output' ? (
  <CodeEditorPanel ... />
) : (
  <InsightsPanel ... />
)}
```

- [ ] **Step 3: Add OrchestrationResult exit_status to props interface if missing**

Check the `OrchestrationResult` type — it should already have `exit_status`. The `RefactoredOutputProps` passes `orchestrationResult` so `orchestrationResult.exit_status` is available.

- [ ] **Step 4: Remove OrchestrationFlowchart import**

Delete the line:
```typescript
import OrchestrationFlowchart from "@/components/features/output/OrchestrationFlowchart";
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/features/output/RefactoredOutput.tsx
git commit -m "feat: add Flow tab to RefactoredOutput panel with MultiAgentFlowGraph"
```

---

### Task 6: Remove Old OrchestrationFlowchart

**Files:**
- Delete: `frontend/src/components/features/output/OrchestrationFlowchart.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm frontend/src/components/features/output/OrchestrationFlowchart.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -rn "OrchestrationFlowchart" frontend/src/`
Expected: no results (clean removal)

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: remove old OrchestrationFlowchart, superseded by MultiAgentFlowGraph"
```

---

### Task 7: Build & Verify

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Workdir: `frontend/`
Expected: no type errors

- [ ] **Step 2: Build**

Run: `npm run build`
Workdir: `frontend/`
Expected: successful build

- [ ] **Step 3: Fix any issues**

If there are type errors or build failures, fix them and repeat steps 1-2.

- [ ] **Step 4: Final commit**

If any fixes were needed:
```bash
git add -A
git commit -m "fix: typecheck and build errors"
```
