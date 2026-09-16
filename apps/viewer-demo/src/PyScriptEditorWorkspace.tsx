import { useEffect, useRef, useState } from "react";
import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { PYSCRIPT_CORE_VERSION, type PyScriptExecutionInput, type PyScriptRuntime } from "@pycom-next/pyodide-agents";
import type { ClinicalViewportTemporaryOverlay } from "@pycom-next/react-viewer";
import { PythonAgentResult, pythonAgentResultError } from "./PythonAgentResult";
import { PyScriptCodeEditor } from "./PyScriptCodeEditor";
import { PYSCRIPT_EDITOR_EXAMPLES } from "./pyscriptExamples";
import { displayPyScriptResult, temporaryOverlayFromPyScriptResult } from "./pyscriptEditorResult";

type EditorPhase = "idle" | "loading" | "running" | "ready" | "failed";
const DEFAULT_EXAMPLE = PYSCRIPT_EDITOR_EXAMPLES[0]!;

interface PyScriptEditorWorkspaceProps {
  busy: boolean;
  snapshot?: ViewerControlPlaneSnapshot | undefined;
  createInput(includeDose: boolean): Promise<PyScriptExecutionInput>;
  ensureRuntime(): Promise<PyScriptRuntime>;
  setBusy(busy: boolean): void;
  resetRuntime(): void;
  setTemporaryOverlay(overlay: ClinicalViewportTemporaryOverlay | undefined): Promise<boolean>;
}

export function PyScriptEditorWorkspace(props: Readonly<PyScriptEditorWorkspaceProps>) {
  const executionGenerationRef = useRef(0);
  const runningRef = useRef(false);
  const [exampleId, setExampleId] = useState(DEFAULT_EXAMPLE.id);
  const [code, setCode] = useState(DEFAULT_EXAMPLE.code);
  const [includeDose, setIncludeDose] = useState(DEFAULT_EXAMPLE.includeDose);
  const [phase, setPhase] = useState<EditorPhase>("idle");
  const [status, setStatus] = useState("PyScript loads on the first run.");
  const [error, setError] = useState("");
  const [result, setResult] = useState<unknown>(undefined);
  const selectedExample = PYSCRIPT_EDITOR_EXAMPLES.find((example) => example.id === exampleId) ?? DEFAULT_EXAMPLE;

  useEffect(() => {
    if (!runningRef.current) {
      return;
    }
    executionGenerationRef.current += 1;
    runningRef.current = false;
    props.resetRuntime();
    props.setBusy(false);
    setPhase("idle");
    setStatus("Execution stopped because the active viewer context changed.");
  }, [props.snapshot]);

  function selectExample(nextId: string) {
    const example = PYSCRIPT_EDITOR_EXAMPLES.find((candidate) => candidate.id === nextId);
    if (!example) {
      return;
    }
    setExampleId(example.id);
    setCode(example.code);
    setIncludeDose(example.includeDose);
    setError("");
    setResult(undefined);
  }

  async function runScript() {
    const executionGeneration = executionGenerationRef.current + 1;
    executionGenerationRef.current = executionGeneration;
    runningRef.current = true;
    setError("");
    setResult(undefined);
    props.setBusy(true);
    setPhase("loading");
    setStatus("Preparing the active image for PyScript...");
    try {
      const [runtime, input] = await Promise.all([props.ensureRuntime(), props.createInput(includeDose)]);
      assertCurrentExecution(executionGenerationRef, executionGeneration);
      setPhase("running");
      setStatus("Running Python in the PyScript worker...");
      const response = await runtime.runEditor(requiredSnapshot(props.snapshot), code, input);
      assertCurrentExecution(executionGenerationRef, executionGeneration);
      const resultError = pythonAgentResultError(response.result);
      if (resultError) {
        throw new Error(resultError);
      }
      const overlay = temporaryOverlayFromPyScriptResult(response.result);
      if (overlay && !await props.setTemporaryOverlay(overlay)) {
        throw new Error("The active renderer rejected the PyScript overlay.");
      }
      setResult(displayPyScriptResult(response.result));
      setPhase("ready");
      setStatus(overlay ? "Script completed. Temporary overlay is visible on this slice." : "Script completed.");
    } catch (runError) {
      if (!isCurrentExecution(executionGenerationRef, executionGeneration)) {
        return;
      }
      const message = errorMessage(runError);
      setError(message);
      setPhase(message.toLowerCase().includes("cancelled") ? "idle" : "failed");
      setStatus(message.toLowerCase().includes("cancelled") ? "PyScript execution stopped." : "PyScript execution failed.");
    } finally {
      completeExecution({ generationRef: executionGenerationRef, generation: executionGeneration, runningRef, setBusy: props.setBusy });
    }
  }

  function stopScript() {
    executionGenerationRef.current += 1;
    runningRef.current = false;
    props.resetRuntime();
    props.setBusy(false);
    setPhase("idle");
    setStatus("PyScript execution stopped.");
  }

  function resetEditor() {
    props.resetRuntime();
    setCode(selectedExample.code);
    setIncludeDose(selectedExample.includeDose);
    setResult(undefined);
    setError("");
    setPhase("idle");
    setStatus("Editor reset. PyScript will create a fresh worker on the next run.");
    void props.setTemporaryOverlay(undefined);
  }

  return (
    <section className="demo-pyscript-editor-workspace" aria-label="PyScript editor">
      <p className="demo-python-agent-status" data-phase={phase} aria-live="polite">{status}</p>
      <div className="demo-pyscript-editor-meta">
        <label>
          <span>Example</span>
          <select value={exampleId} disabled={props.busy} onChange={(event) => selectExample(event.currentTarget.value)}>
            {PYSCRIPT_EDITOR_EXAMPLES.map((example) => <option key={example.id} value={example.id}>{example.label}</option>)}
          </select>
        </label>
        <small>PyScript Core {PYSCRIPT_CORE_VERSION} · Pyodide engine · Web Worker</small>
      </div>
      <p>{selectedExample.description}</p>
      <PyScriptCodeEditor value={code} onChange={setCode} />
      <label className="demo-pyscript-dose-toggle">
        <input type="checkbox" checked={includeDose} disabled={props.busy} onChange={(event) => setIncludeDose(event.currentTarget.checked)} />
        Include visible MHD/RAW dose volume
      </label>
      <div className="demo-pyscript-editor-actions">
        <button type="button" disabled={cannotRun(props.busy, props.snapshot, code)} onClick={() => void runScript()}>Run script</button>
        <button type="button" disabled={!props.busy} onClick={stopScript}>Stop</button>
        <button type="button" disabled={props.busy} onClick={resetEditor}>Reset</button>
        <button type="button" disabled={props.busy} onClick={() => void props.setTemporaryOverlay(undefined)}>Clear overlay</button>
      </div>
      <EditorFeedback error={error} result={result} />
    </section>
  );
}

function EditorFeedback({ error, result }: Readonly<{ error: string; result: unknown }>) {
  return <>{error ? <p className="demo-python-agent-error" role="alert">{error}</p> : null}{result !== undefined ? <PythonAgentResult output={result} /> : null}</>;
}

function cannotRun(busy: boolean, snapshot: ViewerControlPlaneSnapshot | undefined, code: string): boolean {
  return busy || !snapshot || !code.trim();
}

function isCurrentExecution(ref: { current: number }, generation: number): boolean {
  return ref.current === generation;
}

function assertCurrentExecution(ref: { current: number }, generation: number): void {
  if (!isCurrentExecution(ref, generation)) {
    throw new Error("PyScript execution cancelled.");
  }
}

function completeExecution(options: { generationRef: { current: number }; generation: number; runningRef: { current: boolean }; setBusy(busy: boolean): void }): void {
  if (isCurrentExecution(options.generationRef, options.generation)) {
    options.runningRef.current = false;
    options.setBusy(false);
  }
}

function requiredSnapshot(snapshot: ViewerControlPlaneSnapshot | undefined): ViewerControlPlaneSnapshot {
  if (!snapshot) {
    throw new Error("Viewer snapshot is not ready yet.");
  }
  return snapshot;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
