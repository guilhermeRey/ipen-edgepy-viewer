import { describe, expect, it } from "vitest";
import {
  buildPythonWorkerInitializeRequest,
  detectPythonWorkerCapabilities,
  isPythonWorkerResponse,
  normalizePythonAgentManifest,
  serializePythonWorkerError,
  withPyodideCapability,
} from "./pythonWorkerProtocol";

describe("python worker protocol", () => {
  it("builds an initialize request without undefined optional fields", () => {
    expect(buildPythonWorkerInitializeRequest(7)).toEqual({ id: 7, type: "initialize" });

    expect(
      buildPythonWorkerInitializeRequest(8, {
        pyodideModuleUrl: "https://example.test/pyodide.mjs",
        indexUrl: "https://example.test/pyodide/",
      }),
    ).toEqual({
      id: 8,
      type: "initialize",
      pyodideModuleUrl: "https://example.test/pyodide.mjs",
      indexUrl: "https://example.test/pyodide/",
    });
  });

  it("detects SharedArrayBuffer only when cross-origin isolation is enabled", () => {
    const isolated = detectPythonWorkerCapabilities({
      Worker: function WorkerMock() {},
      SharedArrayBuffer: function SharedArrayBufferMock() {},
      crossOriginIsolated: true,
    });
    expect(isolated.worker).toBe(true);
    expect(isolated.sharedArrayBuffer).toBe(true);
    expect(isolated.crossOriginIsolated).toBe(true);

    const nonIsolated = detectPythonWorkerCapabilities({
      Worker: function WorkerMock() {},
      SharedArrayBuffer: function SharedArrayBufferMock() {},
      crossOriginIsolated: false,
    });
    expect(nonIsolated.sharedArrayBuffer).toBe(false);
  });

  it("updates the pyodide capability after initialization", () => {
    const capabilities = detectPythonWorkerCapabilities({ crossOriginIsolated: false });

    expect(capabilities.pyodide).toBe(false);
    expect(withPyodideCapability(capabilities, true).pyodide).toBe(true);
  });

  it("recognizes protocol responses and serializes errors", () => {
    expect(isPythonWorkerResponse({ id: 1, type: "pong", capabilities: detectPythonWorkerCapabilities({}) })).toBe(true);
    expect(isPythonWorkerResponse({ id: 1, type: "agentList", agents: [] })).toBe(true);
    expect(isPythonWorkerResponse({ id: 1, type: "agentResult", agent: { name: "a", version: "1", module: "a" }, result: {} })).toBe(true);
    expect(isPythonWorkerResponse({ id: 1, type: "unknown" })).toBe(false);

    const error = serializePythonWorkerError(new TypeError("bad input"));
    expect(error.name).toBe("TypeError");
    expect(error.message).toBe("bad input");
  });

  it("normalizes Python agent manifests", () => {
    expect(
      normalizePythonAgentManifest({
        version: 1,
        agents: [
          {
            name: " registration-agent ",
            version: "1.0.0",
            module: "registration_agent",
            displayName: " Registration ",
            capabilities: ["registration", "", 42],
            requiresHumanValidation: true,
          },
        ],
      }),
    ).toEqual({
      version: 1,
      agents: [
        {
          name: "registration-agent",
          version: "1.0.0",
          module: "registration_agent",
          displayName: "Registration",
          capabilities: ["registration"],
          requiresHumanValidation: true,
        },
      ],
    });

    expect(() => normalizePythonAgentManifest({ version: 1, agents: [{ name: "missing-module", version: "1" }] })).toThrow("module");
  });
});
