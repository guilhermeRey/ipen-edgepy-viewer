import { describe, expect, it } from "vitest";
import { pythonAgentResultError } from "./PythonAgentResult";

describe("pythonAgentResultError", () => {
  it("extracts an agent error message", () => {
    expect(pythonAgentResultError({ status: "error", result: { message: "No volume." } })).toBe("No volume.");
  });

  it("ignores successful agent results", () => {
    expect(pythonAgentResultError({ status: "ok", result: { max: 1 } })).toBeUndefined();
  });
});
