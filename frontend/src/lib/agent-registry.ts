interface AgentEntry {
  step: number;
  icon: string;
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

export const AGENTS: Record<string, AgentEntry> = {
  Planner:   { step: 1, icon: "Cpu",          colorClass: "text-[#56a8f5]", badgeBg: "#1a2f4a", badgeText: "#5a8cf8", label: "PLANNER" },
  Generator: { step: 2, icon: "Layers",       colorClass: "text-[#2aacb8]", badgeBg: "#1c2e2e", badgeText: "#3dd6c8", label: "GENERATOR" },
  Validator: { step: 3, icon: "FileCode2",    colorClass: "text-[#00e5ff]", badgeBg: "#2e2218", badgeText: "#e09c3b", label: "AST PARSER" },
  Judge:     { step: 4, icon: "CheckCircle2", colorClass: "text-[#27c93f]", badgeBg: "#1a2e1a", badgeText: "#4ec97e", label: "JUDGE" },
  System:    { step: 1, icon: "Clock",        colorClass: "text-yellow-400", badgeBg: "#2a2030", badgeText: "#a78bfa", label: "SYSTEM" },
  Monolith:  { step: 1, icon: "Monolith",     colorClass: "text-[#548af7]", badgeBg: "#1a2f4a", badgeText: "#548af7", label: "MONOLITH" },
};

export const ROLE_VISUALS: Record<string, { step: number; icon: string; colorClass: string }> = {};
export const AGENT_BADGE: Record<string, { bg: string; text: string }> = {};
export const AGENT_LABEL: Record<string, string> = {};

for (const [role, entry] of Object.entries(AGENTS)) {
  ROLE_VISUALS[role] = { step: entry.step, icon: entry.icon, colorClass: entry.colorClass };
  AGENT_BADGE[entry.icon] = { bg: entry.badgeBg, text: entry.badgeText };
  AGENT_LABEL[entry.icon] = entry.label;
}

AGENT_BADGE["AlertCircle"] = { bg: "#3c1a1a", text: "#e06c75" };
AGENT_LABEL["AlertCircle"] = "ERROR";

export const DEFAULT_ROLE_VISUALS = { step: 1, icon: "Cpu", colorClass: "text-jb-accent" };
