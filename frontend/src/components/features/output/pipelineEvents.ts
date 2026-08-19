export type PipelineEventStatus = "pending" | "running" | "pass" | "fail" | "looping";

export interface PipelineEvent {
  phase: number;
  step: number;
  status: PipelineEventStatus;
  loop?: {
    type: "inner" | "outer";
    iteration: number;
    max: number;
  };
  detail: string;
  model_active: "qwen-coder-2.5-3b" | "llama-3.2-3b" | null;
  timestamp: string;
  codeState?: {
    original: string;
    candidate: string;
  };
}

const ORIGINAL_CODE = `public class OrderProcessor {
    public void processOrder(Order order) {
        if (order != null) {
            if (order.getStatus().equals("NEW")) {
                if (order.getItems() != null && !order.getItems().isEmpty()) {
                    for (Item item : order.getItems()) {
                        System.out.println("Processing item: " + item.getName());
                    }
                    order.setStatus("PROCESSED");
                }
            }
        }
    }
}`;

const CANDIDATE_CODE_V1 = `public class OrderProcessor {
    public void processOrder(Order order) {
        if (order == null || !order.getStatus().equals("NEW") || order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }
        
        for (Item item : order.getItems()) {
            System.out.println("Processing item: " + item.getName()) // Syntax error missing semicolon
        }
        
        order.setStatus("PROCESSED");
    }
}`;

const CANDIDATE_CODE_V2 = `public class OrderProcessor {
    public void processOrder(Order order) {
        if (order == null || !order.getStatus().equals("NEW") || order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }
        
        for (Item item : order.getItems()) {
            System.out.println("Processing item: " + item.getName());
        }
        
        // Logic altered: forgot to set status to PROCESSED
    }
}`;

const CANDIDATE_CODE_V3 = `public class OrderProcessor {
    public void processOrder(Order order) {
        if (order == null || !order.getStatus().equals("NEW") || order.getItems() == null || order.getItems().isEmpty()) {
            return;
        }
        
        for (Item item : order.getItems()) {
            System.out.println("Processing item: " + item.getName());
        }
        
        order.setStatus("PROCESSED");
    }
}`;

const time = () => new Date().toISOString();

export const MOCK_PIPELINE_EVENTS: PipelineEvent[] = [
  { phase: 1, step: 1, status: "running", detail: "Reading raw Java snippet and instruction...", model_active: null, timestamp: time() },
  { phase: 1, step: 1, status: "pass", detail: "Input received: Flatten nested conditionals", model_active: null, timestamp: time() },
  { phase: 1, step: 2, status: "running", detail: "Parsing AST via javalang...", model_active: null, timestamp: time() },
  { phase: 1, step: 2, status: "pass", detail: "Baseline AST built. CC=4.", model_active: null, timestamp: time() },
  
  { phase: 2, step: 3, status: "running", detail: "Loading Qwen-Coder 2.5 3B (Planner)", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 2, step: 3, status: "pass", detail: "Intent Packet generated: FLATTEN_CONDITIONAL", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 2, step: 4, status: "running", detail: "Purging model context...", model_active: null, timestamp: time() },
  { phase: 2, step: 4, status: "pass", detail: "Context cleared. Cognitive reset complete.", model_active: null, timestamp: time() },
  { phase: 2, step: 5, status: "running", detail: "Generating AST Modification JSON...", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 2, step: 5, status: "pass", detail: "Plan established.", model_active: "qwen-coder-2.5-3b", timestamp: time() },

  { phase: 3, step: 6, status: "running", detail: "Generator drafting candidate code...", model_active: "qwen-coder-2.5-3b", timestamp: time(), codeState: { original: ORIGINAL_CODE, candidate: ORIGINAL_CODE } },
  { phase: 3, step: 6, status: "pass", detail: "Candidate Code V1 emitted.", model_active: "qwen-coder-2.5-3b", timestamp: time(), codeState: { original: ORIGINAL_CODE, candidate: CANDIDATE_CODE_V1 } },

  // Inner loop triggered (Syntax)
  { phase: 4, step: 7, status: "running", detail: "Tier 1 Validation (Syntax Heal) Check...", model_active: null, timestamp: time() },
  { phase: 4, step: 7, status: "fail", detail: "Syntax error: Missing semicolon at line 8", model_active: null, timestamp: time() },
  { phase: 4, step: 7, status: "looping", loop: { type: "inner", iteration: 1, max: 3 }, detail: "Routing back to Generator for rapid fix.", model_active: null, timestamp: time() },
  
  { phase: 3, step: 6, status: "running", detail: "Generator fixing syntax...", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 3, step: 6, status: "pass", detail: "Candidate Code V2 emitted.", model_active: "qwen-coder-2.5-3b", timestamp: time(), codeState: { original: ORIGINAL_CODE, candidate: CANDIDATE_CODE_V2 } },

  { phase: 4, step: 7, status: "running", detail: "Tier 1 Validation (Syntax Heal) Check...", model_active: null, timestamp: time() },
  { phase: 4, step: 7, status: "pass", detail: "Syntax valid.", model_active: null, timestamp: time() },
  { phase: 4, step: 8, status: "running", detail: "Tier 2 Validation (Structural Fix)...", model_active: null, timestamp: time() },
  { phase: 4, step: 8, status: "pass", detail: "Structural Checks A, B, C passed. CC=3.", model_active: null, timestamp: time() },

  // Outer loop triggered (Logic altered)
  { phase: 5, step: 9, status: "running", detail: "Unloading Qwen. Loading Llama 3.2 3B (Judge)...", model_active: "llama-3.2-3b", timestamp: time() },
  { phase: 5, step: 9, status: "fail", detail: "Semantic equivalence failed. Missing setStatus call.", model_active: "llama-3.2-3b", timestamp: time() },
  { phase: 5, step: 9, status: "looping", loop: { type: "outer", iteration: 1, max: 3 }, detail: "Routing back to Planner for logic revision.", model_active: null, timestamp: time() },

  { phase: 2, step: 5, status: "running", detail: "Re-evaluating AST Plan with Judge notes...", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 2, step: 5, status: "pass", detail: "Plan revised.", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 3, step: 6, status: "running", detail: "Generator drafting code...", model_active: "qwen-coder-2.5-3b", timestamp: time() },
  { phase: 3, step: 6, status: "pass", detail: "Candidate Code V3 emitted.", model_active: "qwen-coder-2.5-3b", timestamp: time(), codeState: { original: ORIGINAL_CODE, candidate: CANDIDATE_CODE_V3 } },
  { phase: 4, step: 7, status: "running", detail: "Tier 1 Validation Check...", model_active: null, timestamp: time() },
  { phase: 4, step: 7, status: "pass", detail: "Syntax valid.", model_active: null, timestamp: time() },
  { phase: 4, step: 8, status: "running", detail: "Tier 2 Validation Check...", model_active: null, timestamp: time() },
  { phase: 4, step: 8, status: "pass", detail: "Structural Checks passed.", model_active: null, timestamp: time() },
  { phase: 5, step: 9, status: "running", detail: "Judge evaluation...", model_active: "llama-3.2-3b", timestamp: time() },
  { phase: 5, step: 9, status: "pass", detail: "Semantic equivalence confirmed.", model_active: "llama-3.2-3b", timestamp: time() },

  { phase: 6, step: 10, status: "running", detail: "Finalizing refactoring metrics...", model_active: null, timestamp: time() },
  { phase: 6, step: 10, status: "pass", detail: "Refactoring complete! CC reduced: 4 -> 3. Loops: 1 Inner, 1 Outer.", model_active: null, timestamp: time() },
];

export const PHASES_CONFIG = [
  { id: 1, name: "Ingestion & Baseline", steps: [1, 2] },
  { id: 2, name: "The Strategy Block", steps: [3, 4, 5] },
  { id: 3, name: "Plan Execution", steps: [6] },
  { id: 4, name: "Deterministic Validation", steps: [7, 8] },
  { id: 5, name: "Heuristic Adjudication", steps: [9] },
  { id: 6, name: "Finalization", steps: [10] },
];
