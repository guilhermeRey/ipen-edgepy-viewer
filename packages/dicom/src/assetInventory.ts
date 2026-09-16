import { buildDicomInventory, type DicomInventoryEntry, type DicomSeriesInventory } from "./inventory";
import { hasSeriesIdentity, type DicomMetadata, type DicomMetadataReader } from "./metadata";
import { classifyDicomPath, scanIdFromPath, type DicomAssetKind } from "./pathClassification";

const DEFAULT_METADATA_KINDS = new Set<DicomAssetKind>(["image"]);

export interface DicomAssetInput {
  path: string;
  data?: ArrayBuffer | Blob;
}

export interface DicomInventoryResult {
  entries: DicomInventoryEntry[];
  series: DicomSeriesInventory[];
}

export interface DicomInventoryProgress {
  completed: number;
  total: number;
  path: string;
  metadataReadCount: number;
  metadataSkippedCount: number;
}

export interface DicomInventoryOptions {
  concurrency?: number;
  metadataKinds?: readonly DicomAssetKind[];
  onProgress?: (progress: DicomInventoryProgress) => void;
  progressInterval?: number;
  signal?: AbortSignal;
}

export async function createDicomInventoryFromAssets(
  assets: readonly DicomAssetInput[],
  metadataReader: DicomMetadataReader,
  options: DicomInventoryOptions = {},
): Promise<DicomInventoryResult> {
  let completed = 0;
  let metadataReadCount = 0;
  let metadataSkippedCount = 0;
  const metadataKinds = options.metadataKinds ? new Set(options.metadataKinds) : DEFAULT_METADATA_KINDS;
  const progressInterval = Math.max(1, options.progressInterval ?? 1);
  const entries = await mapWithConcurrency(
    assets,
    Math.max(1, options.concurrency ?? 8),
    async (asset) => {
      throwIfAborted(options.signal);
      const entry = await createDicomInventoryEntry(asset, metadataReader, metadataKinds);
      if (metadataKinds.has(entry.kind) && asset.data) {
        metadataReadCount += 1;
      } else {
        metadataSkippedCount += 1;
      }
      throwIfAborted(options.signal);
      completed += 1;
      if (completed === assets.length || completed % progressInterval === 0) {
        options.onProgress?.({ completed, total: assets.length, path: asset.path, metadataReadCount, metadataSkippedCount });
      }
      return entry;
    },
  );
  return {
    entries,
    series: buildDicomInventory(entries),
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Import cancelled.");
  }
}

async function createDicomInventoryEntry(
  asset: DicomAssetInput,
  metadataReader: DicomMetadataReader,
  metadataKinds: ReadonlySet<DicomAssetKind>,
): Promise<DicomInventoryEntry> {
  const kind = classifyDicomPath(asset.path);
  const scanId = scanIdFromPath(asset.path);
  const metadata = metadataKinds.has(kind) && asset.data ? await readMetadata(metadataReader, asset.data) : undefined;
  const inferredKind = kind === "other" ? kindFromMetadata(metadata) ?? kind : kind;
  return {
    path: asset.path,
    kind: inferredKind,
    ...(scanId ? { scanId } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function kindFromMetadata(metadata: DicomMetadata | undefined): DicomAssetKind | undefined {
  const modality = metadata?.modality?.toUpperCase();
  if (!modality) {
    return undefined;
  }
  if (modality === "RTSTRUCT") {
    return "rtstruct";
  }
  if (modality === "RTDOSE") {
    return "dose";
  }
  return hasSeriesIdentity(metadata) ? "image" : undefined;
}

async function readMetadata(
  metadataReader: DicomMetadataReader,
  data: ArrayBuffer | Blob,
): Promise<DicomMetadata | undefined> {
  try {
    return await metadataReader.readMetadata(data);
  } catch {
    return undefined;
  }
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
