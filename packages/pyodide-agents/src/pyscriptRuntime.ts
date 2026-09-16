import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import type { PythonAgentDescriptor, PythonAgentFile, PythonAgentManifest } from "./pythonWorkerProtocol";
import {
  PYSCRIPT_CORE_MODULE_URL,
  PYSCRIPT_PYODIDE_MODULE_URL,
  type PendingPyScriptRequest,
  type PyScriptAgentRuntimeResult,
  type PyScriptExecutionInput,
  type PyScriptRequest,
  type PyScriptResponse,
  type PyScriptRuntime,
  type PyScriptRuntimeOptions,
  type PyScriptRuntimeResult,
  type PyScriptWorker,
  type PyScriptWorkerFactory,
} from "./pyscriptTypes";
export * from "./pyscriptTypes";

interface PyScriptCoreModule {
  PyWorker: PyScriptWorkerFactory;
}

export function createPyScriptRuntime(options: PyScriptRuntimeOptions): PyScriptRuntime | undefined {
  if (typeof Worker === "undefined" && !options.workerFactory) {
    return undefined;
  }
  return new BrowserPyScriptRuntime(options);
}

class BrowserPyScriptRuntime implements PyScriptRuntime {
  private nextId = 1;
  private generation = 0;
  private resetError = new Error("PyScript runtime reset.");
  private disposed = false;
  private worker: PyScriptWorker | undefined;
  private workerPromise: Promise<PyScriptWorker> | undefined;
  private readonly pending = new Map<number, PendingPyScriptRequest>();

  constructor(private readonly options: PyScriptRuntimeOptions) {}

  async initialize(): Promise<void> {
    await this.request({ edgepyRequest: true, id: this.nextRequestId(), type: "ping" });
  }

  async installAgentFiles(files: PythonAgentFile[], manifest: PythonAgentManifest): Promise<PythonAgentDescriptor[]> {
    const response = await this.request({
      edgepyRequest: true,
      id: this.nextRequestId(),
      type: "installAgents",
      filesJson: JSON.stringify(files),
      manifestJson: JSON.stringify(manifest),
    });
    if (response.type !== "agentsInstalled" || !response.agents) {
      throw new Error(`Unexpected PyScript response: ${response.type}`);
    }
    return response.agents;
  }

  async runAgent(agentName: string, snapshot: ViewerControlPlaneSnapshot, input?: unknown): Promise<PyScriptAgentRuntimeResult> {
    const envelope = executionEnvelope(input);
    const response = await this.request({
      edgepyRequest: true,
      id: this.nextRequestId(),
      type: "runAgent",
      agentName,
      snapshotJson: JSON.stringify(snapshot),
      inputJson: envelope.json,
      ...(envelope.doseValues ? { doseValues: envelope.doseValues } : {}),
    });
    if (response.type !== "agentResult" || !response.agent) {
      throw new Error(`Unexpected PyScript response: ${response.type}`);
    }
    return { agent: response.agent, result: response.result };
  }

  async runEditor(snapshot: ViewerControlPlaneSnapshot, code: string, input: PyScriptExecutionInput): Promise<PyScriptRuntimeResult> {
    const envelope = executionEnvelope(input);
    const response = await this.request({
      edgepyRequest: true,
      id: this.nextRequestId(),
      type: "runEditor",
      code,
      snapshotJson: JSON.stringify(snapshot),
      inputJson: envelope.json,
      ...(envelope.imageValues ? { imageValues: envelope.imageValues } : {}),
      ...(envelope.doseValues ? { doseValues: envelope.doseValues } : {}),
    });
    if (response.type !== "editorResult") {
      throw new Error(`Unexpected PyScript response: ${response.type}`);
    }
    return { result: response.result };
  }

  cancel(): void {
    this.resetWorker(new Error("PyScript execution cancelled."));
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.resetWorker(new Error("PyScript runtime disposed."));
  }

  private async request(request: PyScriptRequest): Promise<PyScriptResponse> {
    if (this.disposed) {
      throw new Error("PyScript runtime disposed.");
    }
    const generation = this.generation;
    const worker = await this.ensureWorker();
    if (generation !== this.generation) {
      throw this.resetError;
    }
    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      try {
        worker.postMessage(request, requestTransferables(request));
      } catch (error) {
        this.pending.delete(request.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private async ensureWorker(): Promise<PyScriptWorker> {
    if (!this.workerPromise) {
      this.workerPromise = this.createWorker(this.generation);
    }
    const currentPromise = this.workerPromise;
    try {
      return await currentPromise;
    } catch (error) {
      if (this.workerPromise === currentPromise) {
        this.workerPromise = undefined;
      }
      throw error;
    }
  }

  private async createWorker(generation: number): Promise<PyScriptWorker> {
    const factory = this.options.workerFactory ?? await loadPyScriptWorkerFactory();
    const worker = await factory(this.options.bootstrapUrl, { config: { interpreter: PYSCRIPT_PYODIDE_MODULE_URL, sync_main_only: true } });
    if (generation !== this.generation || this.disposed) {
      worker.terminate();
      throw this.resetError;
    }
    this.worker = worker;
    worker.addEventListener("message", (event: MessageEvent<unknown>) => this.handleMessage(event.data));
    worker.addEventListener("error", (event) => this.resetWorker(new Error(event.message || "PyScript worker failed.")));
    return worker;
  }

  private handleMessage(value: unknown): void {
    if (!isPyScriptResponse(value)) {
      return;
    }
    const pending = this.pending.get(value.id);
    if (!pending) {
      return;
    }
    this.pending.delete(value.id);
    if (value.type === "error") {
      pending.reject(errorFromResponse(value));
      return;
    }
    pending.resolve(value);
  }

  private resetWorker(error: Error): void {
    this.generation += 1;
    this.resetError = error;
    this.worker?.terminate();
    this.worker = undefined;
    this.workerPromise = undefined;
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }

  private nextRequestId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }
}

async function loadPyScriptWorkerFactory(): Promise<PyScriptWorkerFactory> {
  const module = await import(/* @vite-ignore */ PYSCRIPT_CORE_MODULE_URL) as PyScriptCoreModule;
  if (typeof module.PyWorker !== "function") {
    throw new Error("PyScript core did not expose PyWorker().");
  }
  return module.PyWorker;
}

function executionEnvelope(input: unknown): { json: string; imageValues?: Float32Array; doseValues?: Float32Array } {
  const imageValues = nestedFloat32Array(input, "image");
  const doseValues = nestedFloat32Array(input, "doseVolume");
  const json = JSON.stringify(input ?? null, (_key, value: unknown) => ArrayBuffer.isView(value) ? undefined : value);
  return {
    json,
    ...(imageValues ? { imageValues } : {}),
    ...(doseValues ? { doseValues } : {}),
  };
}

function nestedFloat32Array(input: unknown, field: string): Float32Array | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const nested = (input as Record<string, unknown>)[field];
  if (!nested || typeof nested !== "object") {
    return undefined;
  }
  const values = (nested as { values?: unknown }).values;
  return values instanceof Float32Array ? values : undefined;
}

function requestTransferables(request: PyScriptRequest): Transferable[] {
  const buffers = [request.imageValues?.buffer, request.doseValues?.buffer].filter((value): value is ArrayBuffer => value instanceof ArrayBuffer);
  return [...new Set(buffers)];
}

function isPyScriptResponse(value: unknown): value is PyScriptResponse {
  return Boolean(value && typeof value === "object" && (value as { edgepyResponse?: unknown }).edgepyResponse === true && typeof (value as { id?: unknown }).id === "number");
}

function errorFromResponse(response: PyScriptResponse): Error {
  const error = new Error(response.error?.message || "PyScript execution failed.");
  error.name = response.error?.name || "Error";
  if (response.error?.stack) {
    error.stack = response.error.stack;
  }
  return error;
}
