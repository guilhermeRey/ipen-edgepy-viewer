import JSZip from "jszip";
import { classifyDicomPath, type DicomAssetInput, type DicomAssetKind } from "@pycom-next/dicom";

export interface LocalImportFile {
  path: string;
  file?: Blob;
}

const ZIP_EXTENSION = ".zip";
const METADATA_BLOB_KINDS = new Set<DicomAssetKind>(["image", "mask", "dose", "rtstruct"]);

interface FileSystemFileHandleLike {
  kind: "file";
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandleLike {
  kind: "directory";
  entries(): AsyncIterable<[string, FileSystemDirectoryHandleLike | FileSystemFileHandleLike]>;
}

export async function filesFromFileList(fileList: FileList | null): Promise<LocalImportFile[]> {
  return expandLocalImportFiles(
    Array.from(fileList ?? [])
      .map((file) => ({ path: file.webkitRelativePath || file.name, file }))
      .filter((file) => !isIgnoredImportPath(file.path)),
  );
}

export async function expandLocalImportFiles(files: readonly LocalImportFile[]): Promise<LocalImportFile[]> {
  return expandZipFiles(files.filter((file) => !isIgnoredImportPath(file.path)));
}

export async function pickDirectoryFiles(): Promise<{ files?: LocalImportFile[]; error?: string }> {
  const picker = (window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
  }).showDirectoryPicker;
  if (!picker) {
    return { error: "Folder Picker is not supported in this browser. Use Folder instead." };
  }
  try {
    return { files: await expandZipFiles(await filesFromDirectoryHandle(await picker())) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {};
    }
    return { error: error instanceof Error ? error.message : "Failed to read folder." };
  }
}

export function assetInputFromFile(file: LocalImportFile): DicomAssetInput {
  return shouldKeepDicomBlob(file.path) && file.file ? { path: file.path, data: file.file } : { path: file.path };
}

async function expandZipFiles(files: readonly LocalImportFile[]): Promise<LocalImportFile[]> {
  const expanded: LocalImportFile[] = [];
  for (const file of files) {
    if (isZipPath(file.path)) {
      expanded.push(...await filesFromZip(file));
    } else {
      expanded.push(file);
    }
  }
  return expanded;
}

async function filesFromZip(file: LocalImportFile): Promise<LocalImportFile[]> {
  if (!file.file) {
    return [];
  }
  const zip = await JSZip.loadAsync(await file.file.arrayBuffer());
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && !isIgnoredZipEntry(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  return Promise.all(entries.map((entry) => fileFromZipEntry(file.path, entry)));
}

async function fileFromZipEntry(sourcePath: string, entry: JSZip.JSZipObject): Promise<LocalImportFile> {
  const path = pathForZipEntry(sourcePath, entry.name);
  return shouldKeepDicomBlob(path) ? { path, file: await entry.async("blob") } : { path };
}

function shouldKeepDicomBlob(path: string): boolean {
  return METADATA_BLOB_KINDS.has(classifyDicomPath(path)) || isExtensionlessPath(path);
}

function isExtensionlessPath(path: string): boolean {
  const name = splitPath(path).at(-1) ?? path;
  return !name.includes(".");
}

async function filesFromDirectoryHandle(directory: FileSystemDirectoryHandleLike): Promise<LocalImportFile[]> {
  const files: LocalImportFile[] = [];
  await collectDirectoryFiles(directory, "", files);
  return files;
}

async function collectDirectoryFiles(
  directory: FileSystemDirectoryHandleLike,
  prefix: string,
  files: LocalImportFile[],
): Promise<void> {
  for await (const [name, handle] of directory.entries()) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      await collectDirectoryFiles(handle, path, files);
    } else if (!isIgnoredImportPath(path)) {
      files.push({ path, file: await handle.getFile() });
    }
  }
}

function pathForZipEntry(sourcePath: string, entryPath: string): string {
  const archiveRoot = sourcePath.slice(0, -ZIP_EXTENSION.length);
  const archiveRootSegments = splitPath(archiveRoot);
  const archiveName = archiveRootSegments.at(-1)?.toLowerCase();
  const entrySegments = splitPath(entryPath);
  if (archiveName && entrySegments[0]?.toLowerCase() === archiveName) {
    return [...archiveRootSegments.slice(0, -1), ...entrySegments].join("/");
  }
  return [...archiveRootSegments, ...entrySegments].join("/");
}

function isZipPath(path: string): boolean {
  return path.toLowerCase().endsWith(ZIP_EXTENSION);
}

function isIgnoredZipEntry(path: string): boolean {
  return isIgnoredImportPath(path);
}

function isIgnoredImportPath(path: string): boolean {
  const normalized = splitPath(path).join("/").toLowerCase();
  return (
    normalized === ".ds_store" ||
    normalized === "thumbs.db" ||
    normalized.startsWith("__macosx/") ||
    normalized.includes("/__macosx/") ||
    normalized.endsWith("/.ds_store") ||
    normalized.endsWith("/thumbs.db")
  );
}

function splitPath(path: string): string[] {
  return path.split(/[\\/]+/).filter(Boolean);
}
