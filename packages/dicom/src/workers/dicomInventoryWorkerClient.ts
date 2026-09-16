import { createWorkerClient, type WorkerClient } from "@pycom-next/worker-runtime";
import type { DicomAssetInput, DicomInventoryProgress, DicomInventoryResult } from "../assetInventory";
import type { DicomAssetKind } from "../pathClassification";
import dicomInventoryWorkerUrl from "./dicomInventoryWorker.ts?worker&url";

export interface DicomInventoryWorkerRequest {
  assets: readonly DicomAssetInput[];
  concurrency?: number | undefined;
  metadataKinds?: readonly DicomAssetKind[] | undefined;
  maxBlobBytes?: number | undefined;
  progressInterval?: number | undefined;
}

export interface DicomInventoryWorkerOptions {
  concurrency?: number | undefined;
  metadataKinds?: readonly DicomAssetKind[] | undefined;
  maxBlobBytes?: number | undefined;
  onProgress?: ((progress: DicomInventoryProgress) => void) | undefined;
  progressInterval?: number | undefined;
}

export interface DicomInventoryWorkerClient {
  createInventoryFromAssets(
    assets: readonly DicomAssetInput[],
    options?: DicomInventoryWorkerOptions,
  ): Promise<DicomInventoryResult>;
  dispose(): void;
}

export function createDicomInventoryWorkerClient(
  workerFactory: () => Worker = createBrowserDicomInventoryWorker,
): DicomInventoryWorkerClient {
  const client: WorkerClient<DicomInventoryWorkerRequest, DicomInventoryResult, DicomInventoryProgress> =
    createWorkerClient(workerFactory);

  return {
    createInventoryFromAssets(assets, options = {}) {
      return client.request(
        {
          assets,
          ...(options.concurrency ? { concurrency: options.concurrency } : {}),
          ...(options.metadataKinds ? { metadataKinds: options.metadataKinds } : {}),
          ...(options.maxBlobBytes ? { maxBlobBytes: options.maxBlobBytes } : {}),
          ...(options.progressInterval ? { progressInterval: options.progressInterval } : {}),
        },
        options.onProgress ? { onProgress: options.onProgress } : undefined,
      );
    },
    dispose() {
      client.dispose();
    },
  };
}

function createBrowserDicomInventoryWorker(): Worker {
  return new Worker(dicomInventoryWorkerUrl, { type: "module" });
}
