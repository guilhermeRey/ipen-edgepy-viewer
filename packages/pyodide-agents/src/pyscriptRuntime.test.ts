import { describe, expect, it } from "vitest";
import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { createPyScriptRuntime, type PyScriptExecutionInput } from "./pyscriptRuntime";

describe("PyScript runtime", () => {
  it("boots a PyScript worker and installs bundled agents", async () => {
    const worker = new FakePyScriptWorker();
    const runtime = createPyScriptRuntime({ bootstrapUrl: "/agents/pyscript_worker.py", workerFactory: async () => worker as unknown as Worker & { sync: object } });

    await runtime?.initialize();
    await expect(runtime?.installAgentFiles([], { version: 1, agents: [] })).resolves.toEqual([]);

    expect(worker.messages.map((message) => message.type)).toEqual(["ping", "installAgents"]);
  });

  it("transfers image and dose buffers to editor executions", async () => {
    const worker = new FakePyScriptWorker();
    const runtime = createPyScriptRuntime({ bootstrapUrl: "/agents/pyscript_worker.py", workerFactory: async () => worker as unknown as Worker & { sync: object } });
    const imageValues = new Float32Array([1, 2]);
    const doseValues = new Float32Array([3, 4]);
    const input: PyScriptExecutionInput = {
      source: "edgepy-viewer",
      image: { width: 2, height: 1, sliceIndex: 0, values: imageValues },
      doseVolume: { dimensions: [2, 1, 1], values: doseValues },
    };

    await runtime?.runEditor(emptySnapshot(), "result = {}", input);

    expect(worker.transferables[0]).toEqual([imageValues.buffer, doseValues.buffer]);
    expect(worker.messages[0]?.inputJson).not.toContain("values");
  });

  it("deduplicates shared transferable buffers", async () => {
    const worker = new FakePyScriptWorker();
    const runtime = createPyScriptRuntime({ bootstrapUrl: "/agents/pyscript_worker.py", workerFactory: async () => worker as unknown as Worker & { sync: object } });
    const buffer = new ArrayBuffer(16);
    const imageValues = new Float32Array(buffer, 0, 2);
    const doseValues = new Float32Array(buffer, 8, 2);

    await runtime?.runEditor(emptySnapshot(), "result = {}", {
      source: "edgepy-viewer",
      image: { width: 2, height: 1, sliceIndex: 0, values: imageValues },
      doseVolume: { values: doseValues },
    });

    expect(worker.transferables[0]).toEqual([buffer]);
  });

  it("terminates the PyScript worker when cancelling", async () => {
    const worker = new FakePyScriptWorker(false);
    const runtime = createPyScriptRuntime({ bootstrapUrl: "/agents/pyscript_worker.py", workerFactory: async () => worker as unknown as Worker & { sync: object } });
    const pending = runtime?.initialize();
    await Promise.resolve();

    runtime?.cancel();

    await expect(pending).rejects.toThrow("cancelled");
    expect(worker.terminated).toBe(true);
  });
});

interface TestRequest {
  id: number;
  type: string;
  inputJson?: string;
}

class FakePyScriptWorker {
  readonly sync = {};
  readonly messages: TestRequest[] = [];
  readonly transferables: Transferable[][] = [];
  terminated = false;
  private messageListener: ((event: MessageEvent<unknown>) => void) | undefined;

  constructor(private readonly autoReply = true) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "message") {
      this.messageListener = listener as (event: MessageEvent<unknown>) => void;
    }
  }

  postMessage(request: TestRequest, transferables: Transferable[] = []): void {
    this.messages.push(request);
    this.transferables.push(transferables);
    if (!this.autoReply) {
      return;
    }
    const responseType = responseTypeForRequest(request.type);
    this.messageListener?.({ data: { edgepyResponse: true, id: request.id, type: responseType, ...(responseType === "agentsInstalled" ? { agents: [] } : { result: {} }) } } as MessageEvent<unknown>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function responseTypeForRequest(type: string): string {
  if (type === "ping") {
    return "pong";
  }
  return type === "installAgents" ? "agentsInstalled" : "editorResult";
}

function emptySnapshot(): ViewerControlPlaneSnapshot {
  return {
    controlPlaneVersion: 1,
    study: { uid: "study", label: "Study", scans: [], series: [], overlays: [] },
    visibleLayers: [],
    fusionContext: { status: "empty", overlayUids: [] },
  };
}
