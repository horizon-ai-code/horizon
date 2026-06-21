import { describe, it, expect } from "vitest";
import { StatusMessageSchema, ServerMessageSchema, ErrorMessageSchema, ResultMessageSchema } from "@/lib/schemas/websocket";

describe("StatusMessageSchema", () => {
  it("parses valid status message", () => {
    const r = StatusMessageSchema.safeParse({
      type: "status", status: "Running...", role: "Planner", phase: 1,
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing status text", () => {
    const r = StatusMessageSchema.safeParse({ type: "status", role: "Planner" });
    expect(r.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const r = StatusMessageSchema.safeParse({ type: "status", status: "ok", role: "Ghost" });
    expect(r.success).toBe(false);
  });

  it("accepts optional fields", () => {
    const r = StatusMessageSchema.safeParse({ type: "status", status: "Test", role: "Judge" });
    expect(r.success).toBe(true);
  });
});

describe("ErrorMessageSchema", () => {
  it("parses error with message only", () => {
    const r = ErrorMessageSchema.safeParse({ type: "error", message: "Something went wrong" });
    expect(r.success).toBe(true);
  });

  it("parses error with code", () => {
    const r = ErrorMessageSchema.safeParse({ type: "error", message: "Bad request", code: "400" });
    expect(r.success).toBe(true);
  });
});

describe("ServerMessageSchema", () => {
  it("discriminates status message", () => {
    const r = ServerMessageSchema.safeParse({ type: "status", status: "ok", role: "Generator" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe("status");
  });

  it("discriminates result message", () => {
    const r = ServerMessageSchema.safeParse({ type: "result", session_id: "abc", refactored_output: "class A {}" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe("result");
  });

  it("discriminates error message", () => {
    const r = ServerMessageSchema.safeParse({ type: "error", message: "err" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe("error");
  });

  it("rejects unknown type", () => {
    const r = ServerMessageSchema.safeParse({ type: "nonexistent" });
    expect(r.success).toBe(false);
  });

  it("rejects missing required field", () => {
    const r = ServerMessageSchema.safeParse({ type: "result" });
    expect(r.success).toBe(false);
  });
});
