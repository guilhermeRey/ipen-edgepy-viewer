import {
  DEFAULT_PYODIDE_MODULE_URL,
  detectPythonWorkerCapabilities,
  normalizePythonAgentManifest,
  serializePythonWorkerError,
  withPyodideCapability,
  type PythonAgentDescriptor,
  type PythonAgentFile,
  type PythonAgentManifest,
  type PythonWorkerCapabilities,
  type PythonWorkerInitializeRequest,
  type PythonWorkerInstallAgentFilesRequest,
  type PythonWorkerRequest,
  type PythonWorkerResponse,
  type PythonWorkerRunAgentRequest,
  type PythonWorkerRunPythonRequest,
  type PythonWorkerRunSnapshotRequest,
} from "./pythonWorkerProtocol";

interface PyodideModule {
  loadPyodide(options: { indexURL?: string }): Promise<PyodideRuntime>;
}

interface PyodideRuntime {
  version?: string;
  FS: PyodideFileSystem;
  globals: PyodideGlobals;
  runPythonAsync(code: string): Promise<unknown>;
}

interface PyodideFileSystem {
  mkdirTree(path: string): void;
  writeFile(path: string, content: string): void;
}

interface PyodideGlobals {
  set(name: string, value: unknown): void;
  get(name: string): unknown;
  delete(name: string): void;
}

interface PythonWorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<PythonWorkerRequest>) => void): void;
  postMessage(response: PythonWorkerResponse): void;
  Worker?: unknown;
  SharedArrayBuffer?: unknown;
  crossOriginIsolated?: boolean;
  edgepy_dose_values?: Float32Array;
}

const workerSelf = self as unknown as PythonWorkerScope;
const AGENT_ROOT = "/home/pyodide/edgepy_agents";

let pyodidePromise: Promise<PyodideRuntime> | undefined;
let capabilities: PythonWorkerCapabilities = detectPythonWorkerCapabilities(workerSelf);
let installedAgentManifest: PythonAgentManifest = { version: 1, agents: [] };

workerSelf.addEventListener("message", (event: MessageEvent<PythonWorkerRequest>) => {
  void handleRequest(event.data);
});

async function handleRequest(request: PythonWorkerRequest): Promise<void> {
  try {
    postResponse(await responseForRequest(request));
  } catch (error) {
    postResponse({ id: request.id, type: "error", error: serializePythonWorkerError(error) });
  }
}

async function responseForRequest(request: PythonWorkerRequest): Promise<PythonWorkerResponse> {
  switch (request.type) {
    case "ping":
      return { id: request.id, type: "pong", capabilities };
    case "initialize": {
      const runtime = await loadRuntime(request);
      return { id: request.id, type: "initialized", capabilities, ...(runtime.version ? { pyodideVersion: runtime.version } : {}) };
    }
    case "runPython":
      return { id: request.id, type: "pythonResult", result: await runPython(request) };
    case "runSnapshot":
      return { id: request.id, type: "pythonResult", result: await runSnapshot(request) };
    case "installAgentFiles":
      return { id: request.id, type: "agentFilesInstalled", agents: await installAgentFiles(request) };
    case "listAgents":
      return { id: request.id, type: "agentList", agents: installedAgentManifest.agents };
    case "runAgent": {
      const { agent, result } = await runAgent(request);
      return { id: request.id, type: "agentResult", agent, result };
    }
    case "dispose":
      return { id: request.id, type: "disposed" };
  }
}

async function installAgentFiles(request: PythonWorkerInstallAgentFilesRequest): Promise<PythonAgentDescriptor[]> {
  const runtime = await loadRuntime({ id: request.id, type: "initialize" });
  runtime.FS.mkdirTree(AGENT_ROOT);
  const basePrefix = manifestBasePrefix(request.files);

  for (const file of request.files) {
    const safePath = safeAgentFilePath(file, basePrefix);
    const targetPath = `${AGENT_ROOT}/${safePath}`;
    const directory = targetPath.slice(0, targetPath.lastIndexOf("/"));
    runtime.FS.mkdirTree(directory);
    runtime.FS.writeFile(targetPath, file.content);
  }

  installedAgentManifest = request.manifest ?? manifestFromFiles(request.files);
  await runtime.runPythonAsync(`
import sys
agent_root = ${JSON.stringify(AGENT_ROOT)}
if agent_root not in sys.path:
    sys.path.insert(0, agent_root)
`);
  return installedAgentManifest.agents;
}

async function runAgent(request: PythonWorkerRunAgentRequest): Promise<{ agent: PythonAgentDescriptor; result: unknown }> {
  const runtime = await loadRuntime({ id: request.id, type: "initialize" });
  const agent = installedAgentManifest.agents.find((candidate) => candidate.name === request.agentName);
  if (!agent) {
    throw new Error(`Python agent '${request.agentName}' is not installed.`);
  }

  setJsonGlobal(runtime, "edgepy_agent_descriptor_json", agent);
  setJsonGlobal(runtime, "edgepy_viewer_snapshot_json", request.snapshot);
  setAgentInputGlobals(runtime, request.input);

  const entrypoint = agent.entrypoint ?? "process";
  const code = `
import importlib
import json

descriptor = json.loads(edgepy_agent_descriptor_json)
context = json.loads(edgepy_viewer_snapshot_json)
agent_input = json.loads(edgepy_input_json)
module = importlib.import_module(descriptor["module"])
if hasattr(module, "agent"):
    process = getattr(module.agent, ${JSON.stringify(entrypoint)})
else:
    process = getattr(module, ${JSON.stringify(entrypoint)})
result = process(context, agent_input)
if hasattr(result, "to_dict"):
    result = result.to_dict()
`;
  return { agent, result: await executePython(runtime, code) };
}

async function runPython(request: PythonWorkerRunPythonRequest): Promise<unknown> {
  const runtime = await loadRuntime({ id: request.id, type: "initialize" });
  setJsonGlobal(runtime, "edgepy_input_json", request.input ?? null);
  return executePython(runtime, request.code);
}

async function runSnapshot(request: PythonWorkerRunSnapshotRequest): Promise<unknown> {
  const runtime = await loadRuntime({ id: request.id, type: "initialize" });
  setJsonGlobal(runtime, "edgepy_viewer_snapshot_json", request.snapshot);
  setJsonGlobal(runtime, "edgepy_input_json", request.input ?? null);
  return executePython(runtime, request.code);
}

async function executePython(runtime: PyodideRuntime, code: string): Promise<unknown> {
  deleteGlobal(runtime, "result");
  const directResult = await runtime.runPythonAsync(code);
  if (directResult !== undefined) {
    return serializePythonValue(directResult);
  }

  const resultGlobal = getGlobal(runtime, "result");
  return serializePythonValue(resultGlobal);
}

async function loadRuntime(request: PythonWorkerInitializeRequest): Promise<PyodideRuntime> {
  if (!pyodidePromise) {
    pyodidePromise = createRuntime(request);
  }

  const runtime = await pyodidePromise;
  capabilities = withPyodideCapability(capabilities, true);
  return runtime;
}

async function createRuntime(request: PythonWorkerInitializeRequest): Promise<PyodideRuntime> {
  const moduleUrl = request.pyodideModuleUrl ?? DEFAULT_PYODIDE_MODULE_URL;
  const module = (await import(/* @vite-ignore */ moduleUrl)) as PyodideModule;
  if (typeof module.loadPyodide !== "function") {
    throw new Error("Pyodide module did not expose loadPyodide().");
  }

  return module.loadPyodide({ ...(request.indexUrl ? { indexURL: request.indexUrl } : {}) });
}

function setJsonGlobal(runtime: PyodideRuntime, name: string, value: unknown): void {
  runtime.globals.set(name, JSON.stringify(value));
}

function setAgentInputGlobals(runtime: PyodideRuntime, input: unknown): void {
  const doseVolume = doseVolumeInput(input);
  if (!doseVolume) {
    delete workerSelf.edgepy_dose_values;
    deleteGlobal(runtime, "edgepy_dose_values");
    setJsonGlobal(runtime, "edgepy_input_json", input ?? null);
    return;
  }
  workerSelf.edgepy_dose_values = doseVolume.values;
  runtime.globals.set("edgepy_dose_values", doseVolume.values);
  const doseVolumeMetadata = Object.fromEntries(Object.entries(doseVolume).filter(([key]) => key !== "values"));
  setJsonGlobal(runtime, "edgepy_input_json", {
    ...(input && typeof input === "object" ? input : {}),
    doseVolume: { ...doseVolumeMetadata, valuesGlobal: "edgepy_dose_values" },
  });
}

function doseVolumeInput(input: unknown): ({ values: Float32Array } & Record<string, unknown>) | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }
  const doseVolume = (input as { doseVolume?: unknown }).doseVolume;
  if (!doseVolume || typeof doseVolume !== "object") {
    return undefined;
  }
  const values = (doseVolume as { values?: unknown }).values;
  return values instanceof Float32Array ? doseVolume as { values: Float32Array } & Record<string, unknown> : undefined;
}

function manifestFromFiles(files: PythonAgentFile[]): PythonAgentManifest {
  const manifestFile = findManifestFile(files);
  if (!manifestFile) {
    throw new Error("Python agent installation requires manifest.json or an explicit manifest.");
  }
  return normalizePythonAgentManifest(JSON.parse(manifestFile.content));
}

function manifestBasePrefix(files: PythonAgentFile[]): string | undefined {
  const manifestFile = findManifestFile(files);
  if (!manifestFile) {
    return undefined;
  }

  const normalized = normalizedAgentPath(manifestFile.path);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex > 0 ? normalized.slice(0, slashIndex + 1) : undefined;
}

function findManifestFile(files: PythonAgentFile[]): PythonAgentFile | undefined {
  return files.find((file) => normalizedAgentPath(file.path).toLowerCase().endsWith("manifest.json"));
}

function safeAgentFilePath(file: PythonAgentFile, basePrefix: string | undefined): string {
  const normalizedPath = normalizedAgentPath(file.path);
  const path = basePrefix && normalizedPath.startsWith(basePrefix) ? normalizedPath.slice(basePrefix.length) : normalizedPath;
  if (!path || path.startsWith("/") || path.split("/").some((part) => part === ".." || part.length === 0)) {
    throw new Error(`Invalid Python agent file path: ${file.path}`);
  }
  return path;
}

function normalizedAgentPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function getGlobal(runtime: PyodideRuntime, name: string): unknown {
  try {
    return runtime.globals.get(name);
  } catch {
    return undefined;
  }
}

function deleteGlobal(runtime: PyodideRuntime, name: string): void {
  try {
    runtime.globals.delete(name);
  } catch {
    // Missing globals are safe to ignore between independent requests.
  }
}

function serializePythonValue(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value ?? null;
  }

  if (isPyProxy(value)) {
    try {
      return value.toJs({ dict_converter: Object.fromEntries });
    } finally {
      value.destroy?.();
    }
  }

  return String(value);
}

function isPyProxy(value: unknown): value is { toJs(options?: unknown): unknown; destroy?: () => void } {
  return typeof value === "object" && value !== null && "toJs" in value && typeof (value as { toJs?: unknown }).toJs === "function";
}

function postResponse(response: PythonWorkerResponse): void {
  workerSelf.postMessage(response);
}
