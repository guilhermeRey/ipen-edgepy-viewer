import { describe, expect, it, vi } from "vitest";
import type { DicomInventoryWorkerClient } from "@pycom-next/dicom";
import { inventoryFromLocalFiles } from "./demoInventoryImport";

describe("demo local inventory import", () => {
  it("keeps mask files path-only during initial metadata import", async () => {
    const mask = new Blob(["not parsed during inventory"]);
    const arrayBuffer = vi.spyOn(mask, "arrayBuffer");
    const statuses: string[] = [];

    const inventory = await inventoryFromLocalFiles(
      [{ path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", file: mask }],
      {
        workerClientRef: { current: null as DicomInventoryWorkerClient | null },
        signal: new AbortController().signal,
        setStatus: (status) => statuses.push(status),
      },
    );

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(statuses[0]).toBe("Reading 1 files (0 metadata candidates)...");
    expect(inventory.entries).toMatchObject([{ kind: "mask", scanId: "Scan1" }]);
  });
});
