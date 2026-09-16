import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import pyodideWorkerUrl from "./pyodide.worker.ts?worker&url";
import {
  buildPythonWorkerInitializeRequest,
  detectPythonWorkerCapabilities,
  isPythonWorkerResponse,
  serializePythonWorkerError,
  type PythonAgentFile,
  type PythonAgentManifest,
  type PythonWorkerAgentFilesInstalledResponse,
  type PythonWorkerAgentListResponse,
  type PythonWorkerAgentRunResultResponse,
  type PythonWorkerCapabilities,
  type PythonWorkerInitializedResponse,
  type PythonWorkerInitializeOptions,
  type PythonWorkerPongResponse,
  type PythonWorkerRequest,
  type PythonWorkerResponse,
  type PythonWorkerRunResultResponse,
} from "./pythonWorkerProtocol";

export interface PythonWorkerRuntimeOptions extends PythonWorkerInitializeOptions {
  worker?: Worker;
}

export interface PythonWorkerRuntime {
  getCapabilities(): PythonWorkerCapabilities;
  initialize(): Promise<PythonWorkerInitializedResponse>;
  ping(): Promise<PythonWorkerPongResponse>;
  runPython(code: string, input?: unknown): Promise<PythonWorkerRunResultResponse>;
  runWithSnapshot(
    snapshot: ViewerControlPlaneSnapshot,
    code: string,
    input?: unknown,
  ): Promise<PythonWorkerRunResultResponse>;
  installAgentFiles(files: PythonAgentFile[], manifest?: PythonAgentManifest): Promise<PythonWorkerAgentFilesInstalledResponse>;
  listAgents(): Promise<PythonWorkerAgentListResponse>;
  runAgent(
    agentName: string,
    snapshot: ViewerControlPlaneSnapshot,
    input?: unknown,
  ): Promise<PythonWorkerAgentRunResultResponse>;
  dispose(): void;
}

interface PendingRequest {
  resolve(response: PythonWorkerResponse): void;
  reject(error: Error): void;
}

export function createPythonWorkerRuntime(options: PythonWorkerRuntimeOptions = {}): PythonWorkerRuntime | undefined {
  if (typeof Worker === "undefined" && !options.worker) {
    return undefined;
  }

  const worker = options.worker ?? new Worker(pyodideWorkerUrl, {
    type: "module",
    name: "edgepy-python-worker",
  });
  return new BrowserPythonWorkerRuntime(worker, options);
}

class BrowserPythonWorkerRuntime implements PythonWorkerRuntime {
  private nextId = 1;
  private disposed = false;
  private capabilities = detectPythonWorkerCapabilities();
  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    private readonly worker: Worker,
    private readonly options: PythonWorkerInitializeOptions,
  ) {
    worker.addEventListener("message", (event: MessageEvent<PythonWorkerResponse>) => {
      this.handleMessage(event.data);
    });
    worker.addEventListener("error", (event) => {
      this.rejectAll(new Error(event.message || "Python worker failed."));
    });
  }

  getCapabilities(): PythonWorkerCapabilities {
    return this.capabilities;
  }

  async initialize(): Promise<PythonWorkerInitializedResponse> {
    const response = await this.request(buildPythonWorkerInitializeRequest(this.nextRequestId(), this.options));
    if (response.type !== "initialized") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    this.capabilities = response.capabilities;
    return response;
  }

  async ping(): Promise<PythonWorkerPongResponse> {
    const response = await this.request({ id: this.nextRequestId(), type: "ping" });
    if (response.type !== "pong") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    this.capabilities = response.capabilities;
    return response;
  }

  async runPython(code: string, input?: unknown): Promise<PythonWorkerRunResultResponse> {
    const request: PythonWorkerRequest = {
      id: this.nextRequestId(),
      type: "runPython",
      code,
      ...(input !== undefined ? { input } : {}),
    };
    return this.expectPythonResult(await this.request(request));
  }

  async runWithSnapshot(
    snapshot: ViewerControlPlaneSnapshot,
    code: string,
    input?: unknown,
  ): Promise<PythonWorkerRunResultResponse> {
    const request: PythonWorkerRequest = {
      id: this.nextRequestId(),
      type: "runSnapshot",
      snapshot,
      code,
      ...(input !== undefined ? { input } : {}),
    };
    return this.expectPythonResult(await this.request(request));
  }

  async installAgentFiles(files: PythonAgentFile[], manifest?: PythonAgentManifest): Promise<PythonWorkerAgentFilesInstalledResponse> {
    const request: PythonWorkerRequest = {
      id: this.nextRequestId(),
      type: "installAgentFiles",
      files,
      ...(manifest ? { manifest } : {}),
    };
    const response = await this.request(request);
    if (response.type !== "agentFilesInstalled") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    return response;
  }

  async listAgents(): Promise<PythonWorkerAgentListResponse> {
    const response = await this.request({ id: this.nextRequestId(), type: "listAgents" });
    if (response.type !== "agentList") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    return response;
  }

  async runAgent(
    agentName: string,
    snapshot: ViewerControlPlaneSnapshot,
    input?: unknown,
  ): Promise<PythonWorkerAgentRunResultResponse> {
    const request: PythonWorkerRequest = {
      id: this.nextRequestId(),
      type: "runAgent",
      agentName,
      snapshot,
      ...(input !== undefined ? { input } : {}),
    };
    const response = await this.request(request);
    if (response.type !== "agentResult") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    return response;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.rejectAll(new Error("Python worker runtime disposed."));
    this.worker.terminate();
  }

  private request(request: PythonWorkerRequest): Promise<PythonWorkerResponse> {
    if (this.disposed) {
      return Promise.reject(new Error("Python worker runtime disposed."));
    }

    return new Promise((resolve, reject) => {
      this.pending.set(request.id, { resolve, reject });
      try {
        this.worker.postMessage(request, transferablesForRequest(request));
      } catch (error) {
        this.pending.delete(request.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleMessage(response: PythonWorkerResponse): void {
    if (!isPythonWorkerResponse(response)) {
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    this.pending.delete(response.id);
    if (response.type === "error") {
      pending.reject(errorFromResponse(response.error));
      return;
    }

    pending.resolve(response);
  }

  private expectPythonResult(response: PythonWorkerResponse): PythonWorkerRunResultResponse {
    if (response.type !== "pythonResult") {
      throw new Error(`Unexpected Python worker response: ${response.type}`);
    }
    return response;
  }

  private nextRequestId(): number {
    const id = this.nextId;
    this.nextId += 1;
    return id;
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function errorFromResponse(error: ReturnType<typeof serializePythonWorkerError>): Error {
  const result = new Error(error.message);
  result.name = error.name;
  if (error.stack) {
    result.stack = error.stack;
  }
  return result;
}

function transferablesForRequest(request: PythonWorkerRequest): Transferable[] {
  const transferables = new Set<Transferable>();
  collectTransferables(request, transferables);
  return [...transferables];
}

function collectTransferables(value: unknown, transferables: Set<Transferable>): void {
  if (value instanceof ArrayBuffer) {
    transferables.add(value);
    return;
  }
  if (ArrayBuffer.isView(value)) {
    transferables.add(value.buffer);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    collectTransferables(item, transferables);
  }
}
