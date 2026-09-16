import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";

export const EDGEPY_PYTHON_WORKER_PROTOCOL_VERSION = 1;
export const DEFAULT_PYODIDE_MODULE_URL = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";

export interface PythonWorkerCapabilities {
  protocolVersion: 1;
  worker: boolean;
  pyodide: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  transferableArrayBuffer: boolean;
}

export interface PythonWorkerCapabilityEnvironment {
  Worker?: unknown;
  SharedArrayBuffer?: unknown;
  crossOriginIsolated?: boolean;
}

export interface PythonWorkerInitializeOptions {
  pyodideModuleUrl?: string;
  indexUrl?: string;
}

export interface PythonAgentManifest {
  version: 1;
  agents: PythonAgentDescriptor[];
}

export interface PythonAgentDescriptor {
  name: string;
  version: string;
  module: string;
  displayName?: string;
  description?: string;
  capabilities?: string[];
  entrypoint?: string;
  requiresHumanValidation?: boolean;
  metadata?: Record<string, unknown>;
}

export interface PythonAgentFile {
  path: string;
  content: string;
}

export interface PythonWorkerInitializeRequest extends PythonWorkerInitializeOptions {
  id: number;
  type: "initialize";
}

export interface PythonWorkerPingRequest {
  id: number;
  type: "ping";
}

export interface PythonWorkerRunPythonRequest {
  id: number;
  type: "runPython";
  code: string;
  input?: unknown;
}

export interface PythonWorkerRunSnapshotRequest {
  id: number;
  type: "runSnapshot";
  code: string;
  snapshot: ViewerControlPlaneSnapshot;
  input?: unknown;
}

export interface PythonWorkerInstallAgentFilesRequest {
  id: number;
  type: "installAgentFiles";
  files: PythonAgentFile[];
  manifest?: PythonAgentManifest;
}

export interface PythonWorkerListAgentsRequest {
  id: number;
  type: "listAgents";
}

export interface PythonWorkerRunAgentRequest {
  id: number;
  type: "runAgent";
  agentName: string;
  snapshot: ViewerControlPlaneSnapshot;
  input?: unknown;
}

export interface PythonWorkerDisposeRequest {
  id: number;
  type: "dispose";
}

export type PythonWorkerRequest =
  | PythonWorkerInitializeRequest
  | PythonWorkerPingRequest
  | PythonWorkerRunPythonRequest
  | PythonWorkerRunSnapshotRequest
  | PythonWorkerInstallAgentFilesRequest
  | PythonWorkerListAgentsRequest
  | PythonWorkerRunAgentRequest
  | PythonWorkerDisposeRequest;

export interface PythonWorkerInitializedResponse {
  id: number;
  type: "initialized";
  pyodideVersion?: string;
  capabilities: PythonWorkerCapabilities;
}

export interface PythonWorkerPongResponse {
  id: number;
  type: "pong";
  capabilities: PythonWorkerCapabilities;
}

export interface PythonWorkerRunResultResponse {
  id: number;
  type: "pythonResult";
  result: unknown;
}

export interface PythonWorkerAgentFilesInstalledResponse {
  id: number;
  type: "agentFilesInstalled";
  agents: PythonAgentDescriptor[];
}

export interface PythonWorkerAgentListResponse {
  id: number;
  type: "agentList";
  agents: PythonAgentDescriptor[];
}

export interface PythonWorkerAgentRunResultResponse {
  id: number;
  type: "agentResult";
  agent: PythonAgentDescriptor;
  result: unknown;
}

export interface PythonWorkerDisposedResponse {
  id: number;
  type: "disposed";
}

export interface PythonWorkerErrorResponse {
  id: number;
  type: "error";
  error: PythonWorkerSerializedError;
}

export interface PythonWorkerSerializedError {
  name: string;
  message: string;
  stack?: string;
}

export type PythonWorkerResponse =
  | PythonWorkerInitializedResponse
  | PythonWorkerPongResponse
  | PythonWorkerRunResultResponse
  | PythonWorkerAgentFilesInstalledResponse
  | PythonWorkerAgentListResponse
  | PythonWorkerAgentRunResultResponse
  | PythonWorkerDisposedResponse
  | PythonWorkerErrorResponse;

const PYTHON_WORKER_RESPONSE_TYPES = new Set(["initialized", "pong", "pythonResult", "agentFilesInstalled", "agentList", "agentResult", "disposed", "error"]);

export function buildPythonWorkerInitializeRequest(
  id: number,
  options: PythonWorkerInitializeOptions = {},
): PythonWorkerInitializeRequest {
  return {
    id,
    type: "initialize",
    ...(options.pyodideModuleUrl ? { pyodideModuleUrl: options.pyodideModuleUrl } : {}),
    ...(options.indexUrl ? { indexUrl: options.indexUrl } : {}),
  };
}

export function detectPythonWorkerCapabilities(
  environment: PythonWorkerCapabilityEnvironment = globalThis as PythonWorkerCapabilityEnvironment,
): PythonWorkerCapabilities {
  const sharedArrayBuffer = typeof environment.SharedArrayBuffer === "function";
  const crossOriginIsolated = environment.crossOriginIsolated === true;

  return {
    protocolVersion: EDGEPY_PYTHON_WORKER_PROTOCOL_VERSION,
    worker: typeof environment.Worker === "function",
    pyodide: false,
    sharedArrayBuffer: sharedArrayBuffer && crossOriginIsolated,
    crossOriginIsolated,
    transferableArrayBuffer: typeof ArrayBuffer === "function",
  };
}

export function withPyodideCapability(
  capabilities: PythonWorkerCapabilities,
  pyodide: boolean,
): PythonWorkerCapabilities {
  return { ...capabilities, pyodide };
}

export function normalizePythonAgentManifest(value: unknown): PythonAgentManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.agents)) {
    throw new Error("Python agent manifest must declare version 1 and an agents array.");
  }

  const agents = value.agents.map(normalizePythonAgentDescriptor);
  return { version: 1, agents };
}

export function normalizePythonAgentDescriptor(value: unknown): PythonAgentDescriptor {
  if (!isRecord(value)) {
    throw new Error("Python agent descriptor must be an object.");
  }

  const name = stringField(value, "name");
  const version = stringField(value, "version");
  const module = stringField(value, "module");
  const descriptor: PythonAgentDescriptor = { name, version, module };

  assignOptionalString(descriptor, value, "displayName");
  assignOptionalString(descriptor, value, "description");
  assignOptionalString(descriptor, value, "entrypoint");
  if (Array.isArray(value.capabilities)) {
    descriptor.capabilities = value.capabilities.filter((capability): capability is string => typeof capability === "string" && capability.length > 0);
  }
  if (typeof value.requiresHumanValidation === "boolean") {
    descriptor.requiresHumanValidation = value.requiresHumanValidation;
  }
  if (isRecord(value.metadata)) {
    descriptor.metadata = value.metadata;
  }

  return descriptor;
}

export function serializePythonWorkerError(error: unknown): PythonWorkerSerializedError {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "Python worker failed.",
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    name: "Error",
    message: typeof error === "string" ? error : safeJsonStringify(error),
  };
}

export function isPythonWorkerResponse(value: unknown): value is PythonWorkerResponse {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.type !== "string") {
    return false;
  }
  return PYTHON_WORKER_RESPONSE_TYPES.has(value.type);
}

function stringField(value: Record<string, unknown>, field: string): string {
  const fieldValue = value[field];
  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    throw new Error(`Python agent descriptor requires '${field}'.`);
  }
  return fieldValue.trim();
}

function assignOptionalString(
  descriptor: PythonAgentDescriptor,
  value: Record<string, unknown>,
  field: "displayName" | "description" | "entrypoint",
): void {
  const fieldValue = value[field];
  if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
    descriptor[field] = fieldValue.trim();
  }
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
