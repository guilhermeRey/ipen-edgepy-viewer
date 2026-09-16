import { useEffect, useRef, useState } from "react";
import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import type { PyScriptExecutionInput, PyScriptRuntime, PythonAgentDescriptor } from "@pycom-next/pyodide-agents";
import type { ClinicalViewportTemporaryOverlay, ViewerCustomPanelPresentation } from "@pycom-next/react-viewer";
import { PythonAgentResult, pythonAgentResultError } from "./PythonAgentResult";
import { PyScriptEditorWorkspace } from "./PyScriptEditorWorkspace";
import { PyScriptPanelLayoutControls } from "./PyScriptPanelLayoutControls";

type AgentPanelPhase = "idle" | "loading" | "ready" | "running" | "failed";
type WorkspaceMode = "editor" | "agents";

interface PythonAgentsPanelProps {
  bundledBaseUrl: string;
  createAgentInput?: ((agent: PythonAgentDescriptor) => Promise<unknown>) | undefined;
  createEditorInput(includeDose: boolean): Promise<PyScriptExecutionInput>;
  presentation: ViewerCustomPanelPresentation;
  setTemporaryOverlay(overlay: ClinicalViewportTemporaryOverlay | undefined): Promise<boolean>;
  snapshot?: ViewerControlPlaneSnapshot | undefined;
  onPresentationChange(presentation: ViewerCustomPanelPresentation): void;
}

export function PythonAgentsPanel(props: Readonly<PythonAgentsPanelProps>) {
  const runtimeRef = useRef<PyScriptRuntime | undefined>(undefined);
  const runtimePromiseRef = useRef<Promise<PyScriptRuntime> | undefined>(undefined);
  const runtimeGenerationRef = useRef(0);
  const disposedRef = useRef(false);
  const [mode, setMode] = useState<WorkspaceMode>("editor");
  const [busy, setBusy] = useState(false);
  const [runtimeGeneration, setRuntimeGeneration] = useState(0);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      runtimeGenerationRef.current += 1;
      runtimeRef.current?.dispose();
    };
  }, []);

  async function ensureRuntime(): Promise<PyScriptRuntime> {
    if (runtimeRef.current) {
      await runtimeRef.current.initialize();
      return runtimeRef.current;
    }
    if (!runtimePromiseRef.current) {
      const generation = runtimeGenerationRef.current;
      const initialization = createRuntime(props.bundledBaseUrl).then(async (runtime) => {
        if (disposedRef.current || generation !== runtimeGenerationRef.current) {
          runtime.dispose();
          throw new Error("PyScript runtime initialization cancelled.");
        }
        runtimeRef.current = runtime;
        await runtime.initialize();
        return runtime;
      });
      const guardedPromise = initialization.catch((error: unknown) => {
        if (runtimePromiseRef.current === guardedPromise) {
          runtimePromiseRef.current = undefined;
        }
        throw error;
      });
      runtimePromiseRef.current = guardedPromise;
    }
    return runtimePromiseRef.current;
  }

  function resetRuntime() {
    runtimeGenerationRef.current += 1;
    runtimeRef.current?.dispose();
    runtimeRef.current = undefined;
    runtimePromiseRef.current = undefined;
    setRuntimeGeneration((current) => current + 1);
  }

  return (
    <section className="pycom-next-panel demo-python-agents" aria-label="PyScript agents and editor">
      <header className="demo-python-agent-heading">
        <span>Browser Python</span>
        <h3>PyScript Lab</h3>
        <p>Edit Python or run local agents against the active medical image.</p>
      </header>
      <PyScriptPanelLayoutControls presentation={props.presentation} onChange={props.onPresentationChange} />
      <nav className="demo-pyscript-tabs" aria-label="PyScript workspace">
        <button type="button" aria-pressed={mode === "editor"} disabled={busy} onClick={() => setMode("editor")}>Editor</button>
        <button type="button" aria-pressed={mode === "agents"} disabled={busy} onClick={() => setMode("agents")}>Agents</button>
      </nav>
      <div hidden={mode !== "editor"}>
        <PyScriptEditorWorkspace
          busy={busy}
          snapshot={props.snapshot}
          createInput={props.createEditorInput}
          ensureRuntime={ensureRuntime}
          resetRuntime={resetRuntime}
          setBusy={setBusy}
          setTemporaryOverlay={props.setTemporaryOverlay}
        />
      </div>
      <div hidden={mode !== "agents"}>
        <BundledAgentsWorkspace
          bundledBaseUrl={props.bundledBaseUrl}
          busy={busy}
          createAgentInput={props.createAgentInput}
          ensureRuntime={ensureRuntime}
          runtimeRef={runtimeRef}
          runtimeGeneration={runtimeGeneration}
          setBusy={setBusy}
          snapshot={props.snapshot}
        />
      </div>
    </section>
  );
}

async function createRuntime(bundledBaseUrl: string): Promise<PyScriptRuntime> {
  const { createPyScriptRuntime } = await import("@pycom-next/pyodide-agents");
  const runtime = createPyScriptRuntime({ bootstrapUrl: agentResourceUrl(bundledBaseUrl, "pyscript_worker.py") });
  if (!runtime) {
    throw new Error("This browser does not support Web Workers required by PyScript.");
  }
  return runtime;
}

function BundledAgentsWorkspace({ bundledBaseUrl, busy, createAgentInput, ensureRuntime, runtimeGeneration, runtimeRef, setBusy, snapshot }: Readonly<{
  bundledBaseUrl: string;
  busy: boolean;
  createAgentInput?: ((agent: PythonAgentDescriptor) => Promise<unknown>) | undefined;
  ensureRuntime(): Promise<PyScriptRuntime>;
  runtimeRef: { current: PyScriptRuntime | undefined };
  runtimeGeneration: number;
  setBusy(busy: boolean): void;
  snapshot?: ViewerControlPlaneSnapshot | undefined;
}>) {
  const [agents, setAgents] = useState<PythonAgentDescriptor[]>([]);
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [status, setStatus] = useState("Load bundled agents into the PyScript worker.");
  const [result, setResult] = useState<unknown>(undefined);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AgentPanelPhase>("idle");
  const selectedAgent = agents.find((agent) => agent.name === selectedAgentName);

  useEffect(() => {
    if (runtimeGeneration === 0) {
      return;
    }
    setAgents([]);
    setSelectedAgentName("");
    setResult(undefined);
    setError("");
    setPhase("idle");
    setStatus("Runtime reset. Load bundled agents into the fresh PyScript worker.");
  }, [runtimeGeneration]);

  async function loadBundledAgents() {
    setError("");
    setResult(undefined);
    setBusy(true);
    setPhase("loading");
    setStatus("Loading PyScript worker and bundled agents...");
    try {
      const response = await installBundledAgents(await ensureRuntime(), bundledBaseUrl);
      setAgents(response);
      setSelectedAgentName((current) => response.some((agent) => agent.name === current) ? current : response[0]?.name || "");
      setPhase("ready");
      setStatus(`${response.length} PyScript agent(s) ready.`);
    } catch (loadError) {
      setError(errorMessage(loadError));
      setPhase("failed");
      setStatus("PyScript agents failed to load.");
    } finally {
      setBusy(false);
    }
  }

  async function runSelectedAgent() {
    setError("");
    setResult(undefined);
    if (!snapshot || !runtimeRef.current || !selectedAgent) {
      setError("Load and select a PyScript agent after the viewer is ready.");
      return;
    }
    setBusy(true);
    try {
      setPhase("running");
      setStatus(`Preparing input for ${selectedAgent.name}...`);
      const input = await inputForAgent(selectedAgent, createAgentInput);
      setStatus(`Running ${selectedAgent.name} in PyScript...`);
      const response = await runtimeRef.current.runAgent(selectedAgent.name, snapshot, input);
      const resultError = pythonAgentResultError(response.result);
      if (resultError) {
        throw new Error(resultError);
      }
      setResult(response.result);
      setPhase("ready");
      setStatus(`${response.agent.displayName ?? response.agent.name} completed.`);
    } catch (runError) {
      setError(errorMessage(runError));
      setPhase("failed");
      setStatus("PyScript agent failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="demo-pyscript-agents-workspace" aria-label="Bundled PyScript agents">
      <p className="demo-python-agent-status" data-phase={phase} aria-live="polite">{status}</p>
      <div className="demo-python-agent-actions">
        <button type="button" className="demo-python-agent-load" disabled={busy} onClick={() => void loadBundledAgents()}>{agents.length > 0 ? "Reload agents" : "Load agents"}</button>
        <label>
          <span>Agent</span>
          <select value={selectedAgentName} disabled={busy || agents.length === 0} onChange={(event) => setSelectedAgentName(event.currentTarget.value)}>
            <option value="">Select agent</option>
            {agents.map((agent) => <option key={agent.name} value={agent.name}>{agent.displayName ?? agent.name}</option>)}
          </select>
        </label>
        <button type="button" className="demo-python-agent-run" disabled={busy || !selectedAgentName || !snapshot} onClick={() => void runSelectedAgent()}>Run agent</button>
      </div>
      {selectedAgent ? <AgentDetails agent={selectedAgent} /> : null}
      {error ? <p className="demo-python-agent-error" role="alert">{error}</p> : null}
      {result !== undefined ? <PythonAgentResult output={result} /> : null}
    </section>
  );
}

async function inputForAgent(agent: PythonAgentDescriptor, createAgentInput: ((agent: PythonAgentDescriptor) => Promise<unknown>) | undefined): Promise<unknown> {
  const input = createAgentInput ? await createAgentInput(agent) : { source: "edgepy-viewer" };
  if (agent.capabilities?.includes("dose-volume") && !hasDoseVolume(input)) {
    throw new Error("No readable MHD/RAW dose volume is available. Add or select a dose overlay containing matching .mhd and .raw files.");
  }
  return input;
}

function hasDoseVolume(input: unknown): boolean {
  return Boolean(input && typeof input === "object" && (input as { doseVolume?: unknown }).doseVolume);
}

function AgentDetails({ agent }: Readonly<{ agent: PythonAgentDescriptor }>) {
  return (
    <section className="demo-python-agent-details">
      <header><strong>{agent.displayName ?? agent.name}</strong><small>v{agent.version}</small></header>
      {agent.description ? <p>{agent.description}</p> : null}
      {agent.capabilities?.length ? <ul aria-label="Agent capabilities">{agent.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul> : null}
      {agent.requiresHumanValidation ? <p className="demo-python-agent-warning">Experimental result. Human validation is required before clinical use.</p> : null}
    </section>
  );
}

async function installBundledAgents(runtime: PyScriptRuntime, bundledBaseUrl: string): Promise<PythonAgentDescriptor[]> {
  const { loadBundledPythonAgents } = await import("@pycom-next/pyodide-agents");
  const bundle = await loadBundledPythonAgents(bundledBaseUrl);
  return runtime.installAgentFiles(bundle.files, bundle.manifest);
}

function agentResourceUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/?$/, "/")}${path}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
