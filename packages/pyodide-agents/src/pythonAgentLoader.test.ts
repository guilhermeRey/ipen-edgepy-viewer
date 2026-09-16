import { describe, expect, it } from "vitest";
import {
  ensurePythonAgentSupportFile,
  loadBundledPythonAgents,
  pythonAgentFilesFromFileList,
  pythonAgentModulePath,
  readPythonAgentManifest,
  type PythonAgentFetch,
} from "./pythonAgentLoader";

describe("python agent loader", () => {
  it("resolves Python module names to file paths", () => {
    expect(pythonAgentModulePath({ name: "summary", version: "1", module: "viewer_context_summary" })).toBe("viewer_context_summary.py");
    expect(pythonAgentModulePath({ name: "nested", version: "1", module: "research.registration.agent" })).toBe("research/registration/agent.py");
    expect(() => pythonAgentModulePath({ name: "bad", version: "1", module: "../bad" })).toThrow("Invalid Python agent module path");
  });

  it("reads a manifest from local agent files", () => {
    const manifest = readPythonAgentManifest([
      { path: "agents/manifest.json", content: JSON.stringify({ version: 1, agents: [{ name: "agent", version: "1", module: "agent" }] }) },
      { path: "agents/agent.py", content: "def process(context, input): return {}" },
    ]);

    expect(manifest.agents[0]?.name).toBe("agent");
  });

  it("converts File API entries to Python agent files", async () => {
    const files = await pythonAgentFilesFromFileList([
      { name: "agent.py", webkitRelativePath: "agents/agent.py", text: async () => "agent" },
      { name: "manifest.json", webkitRelativePath: "agents/manifest.json", text: async () => "manifest" },
    ]);

    expect(files).toEqual([
      { path: "agents/agent.py", content: "agent" },
      { path: "agents/manifest.json", content: "manifest" },
    ]);
  });

  it("loads bundled agents by manifest and module paths", async () => {
    const responses = new Map<string, string>([
      ["/viewer/agents/manifest.json", JSON.stringify({ version: 1, agents: [{ name: "summary", version: "1", module: "viewer_context_summary" }] })],
      ["/viewer/agents/pycom_agent.py", "class PycomAgent: pass"],
      ["/viewer/agents/viewer_context_summary.py", "agent = object()"],
    ]);
    const fetchAgent: PythonAgentFetch = async (url) => ({
      ok: responses.has(url),
      status: responses.has(url) ? 200 : 404,
      statusText: responses.has(url) ? "OK" : "Not Found",
      text: async () => responses.get(url) ?? "",
    });

    const bundle = await loadBundledPythonAgents("/viewer/agents", { fetch: fetchAgent });

    expect(bundle.manifest.agents[0]?.module).toBe("viewer_context_summary");
    expect(bundle.files.map((file) => file.path)).toEqual(["manifest.json", "pycom_agent.py", "viewer_context_summary.py"]);
  });

  it("injects the bundled support file when local agents omit pycom_agent.py", async () => {
    const fetchAgent: PythonAgentFetch = async (url) => ({
      ok: url === "/viewer/agents/pycom_agent.py",
      status: url === "/viewer/agents/pycom_agent.py" ? 200 : 404,
      statusText: url === "/viewer/agents/pycom_agent.py" ? "OK" : "Not Found",
      text: async () => "class PycomAgent: pass",
    });

    const files = await ensurePythonAgentSupportFile(
      [
        { path: "agents/manifest.json", content: JSON.stringify({ version: 1, agents: [{ name: "agent", version: "1", module: "agent" }] }) },
        { path: "agents/agent.py", content: "from pycom_agent import PycomAgent" },
      ],
      { baseUrl: "/viewer/agents", fetch: fetchAgent },
    );

    expect(files.map((file) => file.path)).toEqual(["agents/agent.py", "agents/manifest.json", "pycom_agent.py"]);
  });

  it("does not duplicate pycom_agent.py when local agents include it", async () => {
    const files = await ensurePythonAgentSupportFile([
      { path: "agents/manifest.json", content: JSON.stringify({ version: 1, agents: [{ name: "agent", version: "1", module: "agent" }] }) },
      { path: "agents/pycom_agent.py", content: "class PycomAgent: pass" },
      { path: "agents/agent.py", content: "from pycom_agent import PycomAgent" },
    ]);

    expect(files.filter((file) => file.path.endsWith("pycom_agent.py"))).toHaveLength(1);
  });
});
