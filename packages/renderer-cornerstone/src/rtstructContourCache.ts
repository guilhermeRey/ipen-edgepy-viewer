import type { RtstructContourWorkerClient, RtstructMetadata } from "@pycom-next/dicom";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";

export interface RtstructMetadataCache {
  metadataByPath: Map<string, Promise<RtstructMetadata | undefined>>;
  metricsByPath: Map<string, RtstructMetadataLoadMetrics>;
  workerClient?: Promise<RtstructContourWorkerClient>;
}

export interface RtstructMetadataLoadMetrics {
  loadMs: number;
  pointCount: number;
  contourCount: number;
}

export function createRtstructMetadataCache(): RtstructMetadataCache {
  return { metadataByPath: new Map(), metricsByPath: new Map() };
}

export function disposeRtstructMetadataCache(cache: RtstructMetadataCache): void {
  void cache.workerClient?.then((client) => client.dispose());
}

export async function cachedRtstructMetadata(asset: ClinicalViewportAsset, cache: RtstructMetadataCache): Promise<RtstructMetadata | undefined> {
  const existing = cache.metadataByPath.get(asset.path);
  if (existing) {
    return existing;
  }
  const startedAt = performance.now();
  const promise = rtstructWorkerClient(cache).then((client) => client.readContourMetadata(asset.data)).then((metadata) => {
    cache.metricsByPath.set(asset.path, {
      loadMs: Math.max(0, Math.round(performance.now() - startedAt)),
      pointCount: metadata?.pointCount ?? 0,
      contourCount: metadata?.contourCount ?? 0,
    });
    return metadata;
  });
  cache.metadataByPath.set(asset.path, promise);
  return promise;
}

export function rtstructPointCount(cache: RtstructMetadataCache, assets: readonly ClinicalViewportAsset[]): number | undefined {
  const total = assets.reduce((sum, asset) => sum + (cache.metricsByPath.get(asset.path)?.pointCount ?? 0), 0);
  return total > 0 ? total : undefined;
}

export function rtstructLoadMs(cache: RtstructMetadataCache, assets: readonly ClinicalViewportAsset[]): number | undefined {
  const values = assets.map((asset) => cache.metricsByPath.get(asset.path)?.loadMs).filter((value): value is number => typeof value === "number");
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

async function rtstructWorkerClient(cache: RtstructMetadataCache): Promise<RtstructContourWorkerClient> {
  cache.workerClient ??= import("@pycom-next/dicom").then(({ createRtstructContourWorkerClient }) => createRtstructContourWorkerClient());
  return cache.workerClient;
}
