import { classifyDicomPath } from "@pycom-next/dicom";
import type { LocalImportFile } from "./localImportFiles";

export interface ImportDebugEntry {
  id: number;
  time: string;
  phase: string;
  message: string;
  details?: string;
}

export interface ImportDebugInput {
  phase: string;
  message: string;
  details?: unknown;
}

export function createImportDebugEntry(id: number, input: ImportDebugInput): ImportDebugEntry {
  return {
    id,
    time: new Date().toLocaleTimeString(),
    phase: input.phase,
    message: input.message,
    ...(input.details === undefined ? {} : { details: formatDebugDetails(input.details) }),
  };
}

export function summarizeFileList(fileList: FileList | null): Record<string, unknown> {
  const files = Array.from(fileList ?? []);
  return {
    rawCount: files.length,
    firstPaths: files.slice(0, 5).map((file) => file.webkitRelativePath || file.name),
  };
}

export function summarizeLocalImportFiles(files: readonly LocalImportFile[]): Record<string, unknown> {
  const kindCounts = new Map<string, number>();
  for (const file of files) {
    const kind = classifyDicomPath(file.path);
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }
  return {
    count: files.length,
    kindCounts: Object.fromEntries(kindCounts),
    firstPaths: files.slice(0, 5).map((file) => file.path),
  };
}

function formatDebugDetails(details: unknown): string {
  if (typeof details === "string") {
    return details;
  }
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}
