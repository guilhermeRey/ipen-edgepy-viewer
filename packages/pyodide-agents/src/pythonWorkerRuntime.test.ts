import { describe, expect, it } from "vitest";
import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { createPythonWorkerRuntime } from "./pythonWorkerRuntime";
import { detectPythonWorkerCapabilities, type PythonWorkerRequest, type PythonWorkerResponse } from "./pythonWorkerProtocol";

describe("python worker runtime", () => {
  it("sends requests and resolves typed worker responses", async () => {
    const worker = new FakeWorker((request) => {
      if (request.type === "ping") {
        worker.dispatch({ id: request.id, type: "pong", capabilities: detectPythonWorkerCapabilities({}) });
      }
    });
    const runtime = createPythonWorkerRuntime({ worker: worker as unknown as Worker });

    await expect(runtime?.ping()).resolves.toMatchObject({ type: "pong" });
    expect(worker.messages).toEqual([{ id: 1, type: "ping" }]);
  });

  it("rejects pending requests when disposed", async () => {
    const worker = new FakeWorker(() => undefined);
    const runtime = createPythonWorkerRuntime({ worker: worker as unknown as Worker });
    const pending = runtime?.ping();

    runtime?.dispose();

    await expect(pending).rejects.toThrow("disposed");
    expect(worker.terminated).toBe(true);
  });

  it("transfers dose volume buffers when running an agent", async () => {
    const worker = new FakeWorker((request) => {
      if (request.type === "runAgent") {
        worker.dispatch({ id: request.id, type: "agentResult", agent: { name: "dose", version: "1", module: "dose" }, result: {} });
      }
    });
    const runtime = createPythonWorkerRuntime({ worker: worker as unknown as Worker });
    const values = new Float32Array([1, 2, 3]);

    await runtime?.runAgent("dose", emptySnapshot(), { doseVolume: { values } });

    expect(worker.transferables[0]).toContain(values.buffer);
  });
});

class FakeWorker {
  readonly messages: PythonWorkerRequest[] = [];
  readonly transferables: Transferable[][] = [];
  terminated = false;
  private messageListener: ((event: MessageEvent<PythonWorkerResponse>) => void) | undefined;
  private errorListener: ((event: ErrorEvent) => void) | undefined;

  constructor(private readonly onPostMessage: (request: PythonWorkerRequest) => void) {}

  addEventListener(type: "message" | "error", listener: EventListenerOrEventListenerObject): void {
    if (type === "message") {
      this.messageListener = listener as (event: MessageEvent<PythonWorkerResponse>) => void;
    }
    if (type === "error") {
      this.errorListener = listener as (event: ErrorEvent) => void;
    }
  }

  postMessage(request: PythonWorkerRequest, transferables: Transferable[] = []): void {
    this.messages.push(request);
    this.transferables.push(transferables);
    this.onPostMessage(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  dispatch(response: PythonWorkerResponse): void {
    this.messageListener?.({ data: response } as MessageEvent<PythonWorkerResponse>);
  }

  fail(message: string): void {
    this.errorListener?.({ message } as ErrorEvent);
  }
}

function emptySnapshot(): ViewerControlPlaneSnapshot {
  return {
    controlPlaneVersion: 1,
    study: { uid: "study", label: "Study", scans: [], series: [], overlays: [] },
    visibleLayers: [],
    fusionContext: { status: "empty", overlayUids: [] },
  };
}
