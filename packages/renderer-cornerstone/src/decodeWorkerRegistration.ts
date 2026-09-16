import decodeWorkerUrl from "./uncompressedDecodeWorker.ts?worker&url";

export interface WorkerManagerLike {
  terminate(workerName: string): void;
  registerWorker(workerName: string, workerFn: () => Worker, options?: Record<string, unknown>): void;
}

export function registerDecodeWorker(workerManager: WorkerManagerLike): void {
  workerManager.terminate("dicomImageLoader");
  workerManager.registerWorker("dicomImageLoader", createBundledDecodeWorker, {
    maxWorkerInstances: 1,
    overwrite: true,
  });
}

function createBundledDecodeWorker(): Worker {
  const worker = new Worker(decodeWorkerUrl, { type: "module" });
  worker.addEventListener("error", (event) => {
    console.warn("Cornerstone DICOM decode worker error", event.message);
  });
  worker.addEventListener("messageerror", () => {
    console.warn("Cornerstone DICOM decode worker message error");
  });
  return worker;
}
