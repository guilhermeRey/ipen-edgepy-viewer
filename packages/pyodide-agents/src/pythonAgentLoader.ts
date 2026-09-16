import {
  normalizePythonAgentManifest,
  type PythonAgentDescriptor,
  type PythonAgentFile,
  type PythonAgentManifest,
} from "./pythonWorkerProtocol";

export interface PythonAgentBundle {
  manifest: PythonAgentManifest;
  files: PythonAgentFile[];
}

export interface LoadBundledPythonAgentsOptions {
  fetch?: PythonAgentFetch;
  manifestPath?: string;
  supportFilePath?: string;
}

export interface EnsurePythonAgentSupportFileOptions {
  fetch?: PythonAgentFetch;
  baseUrl?: string;
  supportFilePath?: string;
}

export type PythonAgentFetch = (url: string) => Promise<PythonAgentFetchResponse>;

export interface PythonAgentFetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
}

export interface PythonAgentFileLike {
  name: string;
  webkitRelativePath?: string;
  text(): Promise<string>;
}

const DEFAULT_AGENT_BASE_URL = "agents/";
const DEFAULT_AGENT_MANIFEST_PATH = "manifest.json";
const DEFAULT_AGENT_SUPPORT_FILE_PATH = "pycom_agent.py";

export async function loadBundledPythonAgents(
  baseUrl = DEFAULT_AGENT_BASE_URL,
  options: LoadBundledPythonAgentsOptions = {},
): Promise<PythonAgentBundle> {
  const fetchAgent = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchAgent) {
    throw new Error("loadBundledPythonAgents requires fetch support or an injected fetch function.");
  }

  const manifestPath = options.manifestPath ?? DEFAULT_AGENT_MANIFEST_PATH;
  const supportFilePath = options.supportFilePath ?? DEFAULT_AGENT_SUPPORT_FILE_PATH;
  const manifestContent = await fetchRequiredText(fetchAgent, agentUrl(baseUrl, manifestPath));
  const manifest = normalizePythonAgentManifest(JSON.parse(manifestContent));
  const files = new Map<string, PythonAgentFile>();

  addFile(files, { path: manifestPath, content: manifestContent });
  const supportContent = await fetchOptionalText(fetchAgent, agentUrl(baseUrl, supportFilePath));
  if (supportContent !== undefined) {
    addFile(files, { path: supportFilePath, content: supportContent });
  }

  for (const agent of manifest.agents) {
    const modulePath = pythonAgentModulePath(agent);
    const content = await fetchRequiredText(fetchAgent, agentUrl(baseUrl, modulePath));
    addFile(files, { path: modulePath, content });
  }

  return { manifest, files: [...files.values()] };
}

export async function pythonAgentFilesFromFileList(files: FileList | File[] | PythonAgentFileLike[]): Promise<PythonAgentFile[]> {
  const agentFiles = await Promise.all(
    Array.from(files).map(async (file) => ({
      path: pythonAgentFilePath(file),
      content: await file.text(),
    })),
  );
  return agentFiles.sort((left, right) => left.path.localeCompare(right.path));
}

export function readPythonAgentManifest(files: PythonAgentFile[]): PythonAgentManifest {
  const manifestFile = files.find((file) => normalizedPythonAgentPath(file.path).toLowerCase().endsWith(DEFAULT_AGENT_MANIFEST_PATH));
  if (!manifestFile) {
    throw new Error("Python agent files must include manifest.json.");
  }
  return normalizePythonAgentManifest(JSON.parse(manifestFile.content));
}

export async function ensurePythonAgentSupportFile(
  files: PythonAgentFile[],
  options: EnsurePythonAgentSupportFileOptions = {},
): Promise<PythonAgentFile[]> {
  const supportFilePath = options.supportFilePath ?? DEFAULT_AGENT_SUPPORT_FILE_PATH;
  if (files.some((file) => normalizedPythonAgentPath(file.path).toLowerCase().endsWith(supportFilePath.toLowerCase()))) {
    return files;
  }

  const fetchAgent = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchAgent) {
    throw new Error(`Python agent folder must include ${supportFilePath} or fetch support must be available.`);
  }

  const supportContent = await fetchRequiredText(fetchAgent, agentUrl(options.baseUrl ?? DEFAULT_AGENT_BASE_URL, supportFilePath));
  return [...files, { path: supportFilePath, content: supportContent }].sort((left, right) => left.path.localeCompare(right.path));
}

export function pythonAgentModulePath(agent: PythonAgentDescriptor): string {
  const modulePath = agent.module.trim().replace(/\./g, "/");
  if (!modulePath || modulePath.startsWith("/") || modulePath.split("/").some((part) => part.length === 0 || part === "..")) {
    throw new Error(`Invalid Python agent module path: ${agent.module}`);
  }
  return `${modulePath}.py`;
}

export function normalizedPythonAgentPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function pythonAgentFilePath(file: PythonAgentFileLike): string {
  const path = normalizedPythonAgentPath(file.webkitRelativePath || file.name);
  if (!path || path.startsWith("/") || path.split("/").some((part) => part.length === 0 || part === "..")) {
    throw new Error(`Invalid Python agent file path: ${path || file.name}`);
  }
  return path;
}

function agentUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBaseUrl}${normalizedPythonAgentPath(path)}`;
}

async function fetchRequiredText(fetchAgent: PythonAgentFetch, url: string): Promise<string> {
  const response = await fetchAgent(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Python agent file '${url}' (${response.status} ${response.statusText ?? ""}).`);
  }
  return response.text();
}

async function fetchOptionalText(fetchAgent: PythonAgentFetch, url: string): Promise<string | undefined> {
  try {
    const response = await fetchAgent(url);
    if (!response.ok) {
      return undefined;
    }
    return response.text();
  } catch {
    return undefined;
  }
}

function addFile(files: Map<string, PythonAgentFile>, file: PythonAgentFile): void {
  files.set(normalizedPythonAgentPath(file.path), { path: normalizedPythonAgentPath(file.path), content: file.content });
}
