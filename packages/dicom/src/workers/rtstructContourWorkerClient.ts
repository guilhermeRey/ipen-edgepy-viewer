import { createWorkerClient, type WorkerClient } from "@pycom-next/worker-runtime";
import type { RtstructMetadata } from "../metadata";
import rtstructContourWorkerUrl from "./rtstructContourWorker.ts?worker&url";

export interface RtstructContourWorkerRequest {
  data: ArrayBuffer | Blob;
}

export interface RtstructContourWorkerClient {
  readContourMetadata(data: ArrayBuffer | Blob): Promise<RtstructMetadata | undefined>;
  dispose(): void;
}

export function createRtstructContourWorkerClient(
  workerFactory: () => Worker = createBrowserRtstructContourWorker,
): RtstructContourWorkerClient {
  const client: WorkerClient<RtstructContourWorkerRequest, RtstructMetadata | undefined> = createWorkerClient(workerFactory);
  return {
    readContourMetadata(data) {
      return client.request({ data });
    },
    dispose() {
      client.dispose();
    },
  };
}

function createBrowserRtstructContourWorker(): Worker {
  return new Worker(rtstructContourWorkerUrl, { type: "module" });
}
