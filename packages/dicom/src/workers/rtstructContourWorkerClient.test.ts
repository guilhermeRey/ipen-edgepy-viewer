import { exposeWorkerHandler } from "@pycom-next/worker-runtime";
import { describe, expect, it } from "vitest";
import type { RtstructMetadata } from "../metadata";
import { createRtstructContourWorkerClient, type RtstructContourWorkerRequest } from "./rtstructContourWorkerClient";

describe("RTSTRUCT contour worker client", () => {
  it("proxies contour metadata requests through worker runtime", async () => {
    const linkedWorker = createLinkedWorker();
    const response: RtstructMetadata = { structureCount: 1, contourCount: 1, pointCount: 4, structures: [] };
    exposeWorkerHandler<RtstructContourWorkerRequest, RtstructMetadata | undefined>(
      linkedWorker.scope,
      () => response,
    );
    const client = createRtstructContourWorkerClient(() => linkedWorker.client as unknown as Worker);

    await expect(client.readContourMetadata(new ArrayBuffer(0))).resolves.toEqual(response);

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
