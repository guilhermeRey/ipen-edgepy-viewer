import { exposeWorkerHandler } from "@pycom-next/worker-runtime";
import { createDicomInventoryFromAssets, type DicomInventoryProgress, type DicomInventoryResult } from "../assetInventory";
import { DicomParserMetadataReader } from "../adapters/dicomParserMetadataReader";
import type { DicomInventoryWorkerRequest } from "./dicomInventoryWorkerClient";

exposeWorkerHandler<DicomInventoryWorkerRequest, DicomInventoryResult, DicomInventoryProgress>(
  self,
  (request, { progress }) =>
    createDicomInventoryFromAssets(
      request.assets,
      new DicomParserMetadataReader({ ...(request.maxBlobBytes ? { maxBlobBytes: request.maxBlobBytes } : {}) }),
      {
        ...(request.concurrency ? { concurrency: request.concurrency } : {}),
        ...(request.metadataKinds ? { metadataKinds: request.metadataKinds } : {}),
        onProgress: progress,
        ...(request.progressInterval ? { progressInterval: request.progressInterval } : {}),
      },
    ),
);
