import {
  createDicomInventoryFromAssets,
  createDicomInventoryWorkerClient,
  classifyDicomPath,
  DicomParserMetadataReader,
  type DicomAssetInput,
  type DicomAssetKind,
  type DicomInventoryProgress,
  type DicomInventoryResult,
  type DicomInventoryWorkerClient,
} from "@pycom-next/dicom";
import { assetInputFromFile, type LocalImportFile } from "./localImportFiles";

const LOCAL_IMPORT_CONCURRENCY = 12;
const LOCAL_IMPORT_METADATA_KINDS = ["image", "rtstruct", "other"] as const satisfies readonly DicomAssetKind[];
const LOCAL_IMPORT_METADATA_KIND_SET = new Set<DicomAssetKind>(LOCAL_IMPORT_METADATA_KINDS);
const LOCAL_IMPORT_PROGRESS_INTERVAL = 50;

interface MutableValueRef<T> {
  current: T;
}

interface InventoryFromLocalFilesOptions {
  workerClientRef: MutableValueRef<DicomInventoryWorkerClient | null>;
  signal: AbortSignal;
  setStatus(status: string): void;
}

interface CreateInventoryOptions {
  workerClientRef: MutableValueRef<DicomInventoryWorkerClient | null>;
  signal: AbortSignal;
  onProgress(progress: DicomInventoryProgress): void;
}

export async function inventoryFromLocalFiles(
  files: readonly LocalImportFile[],
  options: InventoryFromLocalFilesOptions,
): Promise<DicomInventoryResult> {
  const assets = files.map(assetInputFromFile);
  options.setStatus(`Reading ${files.length} files (${metadataCandidateCount(assets)} metadata candidates)...`);
  return createInventory(assets, {
    workerClientRef: options.workerClientRef,
    signal: options.signal,
    onProgress(progress) {
      if (progress.completed === progress.total || progress.completed % 50 === 0) {
        options.setStatus(`Reading DICOM metadata ${progress.completed}/${progress.total} files (${progress.metadataReadCount} parsed, ${progress.metadataSkippedCount} path-only)...`);
      }
    },
  });
}

function metadataCandidateCount(assets: readonly DicomAssetInput[]): number {
  return assets.filter((asset) => asset.data && LOCAL_IMPORT_METADATA_KIND_SET.has(classifyDicomPath(asset.path))).length;
}

export function assetByPathFromFiles(files: readonly LocalImportFile[]): ReadonlyMap<string, Blob> {
  return new Map(files.flatMap((file) => (file.file ? [[file.path, file.file] as const] : [])));
}

export function mergeAssetMaps(left: ReadonlyMap<string, Blob>, right: ReadonlyMap<string, Blob>): ReadonlyMap<string, Blob> {
  return new Map([...left, ...right]);
}

async function createInventory(
  assets: readonly DicomAssetInput[],
  { workerClientRef, signal, onProgress }: CreateInventoryOptions,
): Promise<DicomInventoryResult> {
  if (typeof Worker !== "undefined") {
    try {
      workerClientRef.current ??= createDicomInventoryWorkerClient();
      return await workerClientRef.current.createInventoryFromAssets(assets, {
        concurrency: LOCAL_IMPORT_CONCURRENCY,
        metadataKinds: LOCAL_IMPORT_METADATA_KINDS,
        onProgress,
        progressInterval: LOCAL_IMPORT_PROGRESS_INTERVAL,
      });
    } catch (error) {
      if (signal.aborted) {
        throw new Error("Import cancelled.", { cause: error });
      }
      workerClientRef.current?.dispose();
      workerClientRef.current = null;
      console.warn("DICOM inventory worker failed; falling back to main thread.", error);
    }
  }

  return createDicomInventoryFromAssets(assets, new DicomParserMetadataReader(), {
    concurrency: LOCAL_IMPORT_CONCURRENCY,
    metadataKinds: LOCAL_IMPORT_METADATA_KINDS,
    onProgress,
    progressInterval: LOCAL_IMPORT_PROGRESS_INTERVAL,
    signal,
  });
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to import local files.";
}
