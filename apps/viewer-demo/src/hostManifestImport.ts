import { normalizeLogicalPath, type HostAsset, type HostAssetManifest } from "@pycom-next/host-integration";
import { expandLocalImportFiles, type LocalImportFile } from "./localImportFiles";

interface HostManifestImportOptions {
  fetch?: typeof fetch | undefined;
  onDebug?(phase: string, message: string, details?: unknown): void;
  signal?: AbortSignal | undefined;
}

interface HostAssetDownloadContext {
  fetcher: typeof fetch;
  manifestBaseUrl: string;
  options: HostManifestImportOptions;
}

export async function localImportFilesFromHostManifestUrl(
  manifestUrl: string,
  options: HostManifestImportOptions = {},
): Promise<{ files: LocalImportFile[]; manifest: HostAssetManifest }> {
  const fetcher = hostManifestFetcher(options);

  options.onDebug?.("manifest", "Fetching HostAssetManifest.", { manifestUrl });
  const manifestResponse = await fetcher(manifestUrl, requestInit(options.signal));
  if (!manifestResponse.ok) {
    throw new Error(`Failed to fetch HostAssetManifest (${manifestResponse.status} ${manifestResponse.statusText}).`);
  }

  const manifest = normalizeHostAssetManifest(await manifestResponse.json());
  options.onDebug?.("manifest", "HostAssetManifest received.", {
    label: manifest.label,
    studyUid: manifest.studyUid,
    assets: manifest.assets.length,
  });

  const manifestBaseUrl = new URL(manifestUrl, globalThis.location?.href ?? manifestUrl).href;
  const downloaded = await Promise.all(manifest.assets.map((asset) => downloadHostAsset(asset, { fetcher, manifestBaseUrl, options })));
  const files = await expandLocalImportFiles(downloaded);
  options.onDebug?.("manifest", "Host assets ready for local import pipeline.", {
    downloadedAssets: downloaded.length,
    expandedFiles: files.length,
  });
  return { files, manifest };
}

function hostManifestFetcher(options: HostManifestImportOptions): typeof fetch {
  const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetcher) {
    throw new Error("Host manifest import requires fetch support.");
  }
  return fetcher;
}

function normalizeHostAssetManifest(value: unknown): HostAssetManifest {
  if (!isRecord(value) || !Array.isArray(value.assets)) {
    throw new Error("HostAssetManifest must be an object with an assets array.");
  }
  return {
    ...(typeof value.studyUid === "string" && value.studyUid ? { studyUid: value.studyUid } : {}),
    ...(typeof value.label === "string" && value.label ? { label: value.label } : {}),
    assets: value.assets.map(normalizeHostAsset),
    ...(isRecord(value.metadata) ? { metadata: value.metadata } : {}),
  };
}

function normalizeHostAsset(value: unknown): HostAsset {
  if (!isRecord(value)) {
    throw new Error("HostAsset must be an object.");
  }
  return cleanUndefined({
    path: normalizeLogicalPath(String(value.path ?? "")),
    url: stringValue(value.url),
    kind: typeof value.kind === "string" ? hostAssetKind(value.kind) : undefined,
    contentType: stringValue(value.contentType),
    size: finiteNumber(value.size),
    metadata: isRecord(value.metadata) ? value.metadata : undefined,
  }) as HostAsset;
}

async function downloadHostAsset(
  asset: HostAsset,
  context: HostAssetDownloadContext,
): Promise<LocalImportFile> {
  const assetUrl = new URL(asset.url ?? asset.path, context.manifestBaseUrl).href;
  context.options.onDebug?.("manifest", `Fetching asset ${asset.path}.`, { url: assetUrl, kind: asset.kind, size: asset.size });
  const response = await context.fetcher(assetUrl, requestInit(context.options.signal));
  if (!response.ok) {
    throw new Error(`Failed to fetch host asset '${asset.path}' (${response.status} ${response.statusText}).`);
  }
  const blob = await response.blob();
  context.options.onDebug?.("manifest", `Fetched asset ${asset.path}.`, { bytes: blob.size, contentType: blob.type });
  return { path: asset.path, file: blob };
}

function hostAssetKind(value: string): HostAsset["kind"] | undefined {
  if (value === "archive" || value === "dicom" || value === "mask" || value === "rtstruct" || value === "dose" || value === "other") {
    return value;
  }
  return undefined;
}

function requestInit(signal: AbortSignal | undefined): RequestInit {
  return { credentials: "same-origin", ...(signal ? { signal } : {}) };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function cleanUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
