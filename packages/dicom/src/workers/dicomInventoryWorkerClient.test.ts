import { exposeWorkerHandler } from "@pycom-next/worker-runtime";
import { describe, expect, it } from "vitest";
import type { DicomInventoryProgress, DicomInventoryResult } from "../assetInventory";
import { createDicomInventoryWorkerClient, type DicomInventoryWorkerRequest } from "./dicomInventoryWorkerClient";

describe("DICOM inventory worker client", () => {
  it("proxies request, progress and response through worker runtime", async () => {
    const linkedWorker = createLinkedWorker();
    exposeWorkerHandler<DicomInventoryWorkerRequest, DicomInventoryResult, DicomInventoryProgress>(
      linkedWorker.scope,
      (request, { progress }) => {
        progress({
          completed: request.assets.length,
          total: request.assets.length,
          path: request.assets[0]?.path ?? "",
          metadataReadCount: request.assets.length,
          metadataSkippedCount: 0,
        });
        return { entries: [], series: [] };
      },
    );
    const client = createDicomInventoryWorkerClient(() => linkedWorker.client as unknown as Worker);
    const progress: number[] = [];

    await expect(
      client.createInventoryFromAssets(
        [{ path: "scan1/ct/001.dcm", data: new ArrayBuffer(0) }],
        { onProgress: (event) => progress.push(event.completed) },
      ),
    ).resolves.toEqual({ entries: [], series: [] });
    expect(progress).toEqual([1]);

    client.dispose();
  });
});

function createLinkedWorker() {
  const clientListeners: Array<(event: MessageEvent) => void> = [];
  const scopeListeners: Array<(event: MessageEvent) => void> = [];

  const client = {
    addEventListener(type: string, listener: (event: MessageEvent) => void) {
      if (type === "message") {
        clientListeners.push(listener);
      }
    },
    postMessage(data: unknown) {
      queueMicrotask(() => {
        for (const listener of scopeListeners) {
          listener({ data } as MessageEvent);
        }
      });
    },
    terminate() {},
  };

  const scope = {
    addEventListener(type: "message", listener: (event: MessageEvent) => void) {
      if (type === "message") {
        scopeListeners.push(listener);
      }
    },
    postMessage(data: unknown) {
      queueMicrotask(() => {
        for (const listener of clientListeners) {
          listener({ data } as MessageEvent);
        }
      });
    },
  };

  return { client, scope };
}
