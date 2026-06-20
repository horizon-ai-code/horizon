import { z } from "zod";

const RoleSchema = z.enum(["System", "Planner", "Generator", "Validator", "Judge", "Monolith"]);

export const StatusMessageSchema = z.object({
  type: z.literal("status"),
  status: z.string().min(1),
  role: RoleSchema,
  phase: z.number().int().min(0).max(6).optional(),
  iteration: z.number().int().optional(),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export const ResultMessageSchema = z.object({
  type: z.literal("result"),
  session_id: z.string(),
  refactored_output: z.string(),
  original_complexity: z.number().optional(),
  refactored_complexity: z.number().optional(),
  exit_status: z.string().optional(),
  performance_metrics: z.record(z.string(), z.unknown()).optional(),
});

export const ErrorMessageSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  code: z.string().optional(),
});

export const InsightsMessageSchema = z.object({
  type: z.literal("insights"),
  insights: z.array(z.record(z.string(), z.unknown())),
});

export const PhaseStartedMessageSchema = z.object({
  type: z.literal("phase_started"),
  phase: z.number().int(),
  phase_name: z.string(),
});

export const HaltAckMessageSchema = z.object({
  type: z.literal("halt_acknowledged"),
  id: z.string().optional(),
});

export const ServerMessageSchema = z.discriminatedUnion("type", [
  StatusMessageSchema,
  ResultMessageSchema,
  ErrorMessageSchema,
  InsightsMessageSchema,
  PhaseStartedMessageSchema,
  HaltAckMessageSchema,
]);

export type ValidatedServerMessage = z.infer<typeof ServerMessageSchema>;
