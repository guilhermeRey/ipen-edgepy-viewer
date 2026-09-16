import { describe, expect, it } from "vitest";
import { createWorkerClient, exposeWorkerHandler } from "./index";

describe("worker runtime", () => {
  it("handles request, progress and response messages", async () => {
    const worker = createLinkedWorker();
    exposeWorkerHandler<{ value: number }, number, number>(worker.scope, async (request, { progress }) => {
      progress(request.value);
      return request.value * 2;
    });
    const client = createWorkerClient<{ value: number }, number, number>(() => worker.client as unknown as Worker);
    const progress: number[] = [];

    await expect(client.request({ value: 21 }, { onProgress: (value) => progress.push(value) })).resolves.toBe(42);
    expect(progress).toEqual([21]);

    client.dispose();
  });

  it("rejects serialized worker errors", async () => {
    const worker = createLinkedWorker();
    exposeWorkerHandler(worker.scope, () => {
      throw new Error("boom");
    });
    const client = createWorkerClient<undefined, undefined>(() => worker.client as unknown as Worker);

    await expect(client.request(undefined)).rejects.toThrow("boom");

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
    addEventListener(type: string, listener: (event: MessageEvent) => void) {
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
