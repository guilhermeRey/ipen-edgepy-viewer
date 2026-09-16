import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import type { PythonAgentDescriptor, PythonAgentFile, PythonAgentManifest } from "./pythonWorkerProtocol";

export const PYSCRIPT_CORE_VERSION = "2026.7.2";
export const PYSCRIPT_CORE_MODULE_URL = `https://pyscript.net/releases/${PYSCRIPT_CORE_VERSION}/core.js`;
export const PYSCRIPT_PYODIDE_MODULE_URL = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";

export interface PyScriptImageInput {
  width: number;
  height: number;
  sliceIndex: number;
  values: Float32Array;
  imageId?: string | undefined;
  seriesUid?: string | undefined;
}

export interface PyScriptExecutionInput {
  source: "edgepy-viewer";
  image?: PyScriptImageInput | undefined;
  doseVolume?: PyScriptDoseVolumeInput | undefined;
}

export interface PyScriptDoseVolumeInput {
  values: Float32Array;
  uid?: string | undefined;
  label?: string | undefined;
  paths?: string[] | undefined;
  dimensions?: readonly number[] | undefined;
  spacing?: readonly number[] | undefined;
  offset?: readonly number[] | undefined;
  elementType?: string | undefined;
  valueCount?: number | undefined;
}

export interface PyScriptRuntimeResult {
  result: unknown;
}

export interface PyScriptAgentRuntimeResult extends PyScriptRuntimeResult {
  agent: PythonAgentDescriptor;
}

export interface PyScriptRuntime {
  initialize(): Promise<void>;
  installAgentFiles(files: PythonAgentFile[], manifest: PythonAgentManifest): Promise<PythonAgentDescriptor[]>;
  runAgent(agentName: string, snapshot: ViewerControlPlaneSnapshot, input?: unknown): Promise<PyScriptAgentRuntimeResult>;
  runEditor(snapshot: ViewerControlPlaneSnapshot, code: string, input: PyScriptExecutionInput): Promise<PyScriptRuntimeResult>;
  cancel(): void;
  dispose(): void;
}

export interface PyScriptWorker extends Worker {
  readonly sync: object;
}

export type PyScriptWorkerFactory = (file: string, options: { config: object }) => Promise<PyScriptWorker>;

export interface PyScriptRuntimeOptions {
  bootstrapUrl: string;
  workerFactory?: PyScriptWorkerFactory | undefined;
}

export interface PyScriptRequest {
  edgepyRequest: true;
  id: number;
  type: "ping" | "installAgents" | "runAgent" | "runEditor";
  agentName?: string | undefined;
  code?: string | undefined;
  filesJson?: string | undefined;
  inputJson?: string | undefined;
  manifestJson?: string | undefined;
  snapshotJson?: string | undefined;
  imageValues?: Float32Array | undefined;
  doseValues?: Float32Array | undefined;
}

export interface PyScriptResponse {
  edgepyResponse: true;
  id: number;
  type: "pong" | "agentsInstalled" | "agentResult" | "editorResult" | "error";
  agent?: PythonAgentDescriptor | undefined;
  agents?: PythonAgentDescriptor[] | undefined;
  error?: { message?: string | undefined; name?: string | undefined; stack?: string | undefined } | undefined;
  result?: unknown;
}

export interface PendingPyScriptRequest {
  resolve(response: PyScriptResponse): void;
  reject(error: Error): void;
}
