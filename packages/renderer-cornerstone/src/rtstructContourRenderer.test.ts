import type { RtstructContourWorkerClient } from "@pycom-next/dicom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";
import type { FusionOverlayLayer, WorldMappableViewportLike } from "./fusionOverlayTypes";
import { createRtstructMetadataCache } from "./rtstructContourCache";
import { drawRtstructLayer } from "./rtstructContourRenderer";

describe("drawRtstructLayer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not report skipped RTSTRUCT when an obsolete worker request is disposed", async () => {
    const cache = createRtstructMetadataCache();
    cache.workerClient = Promise.resolve(workerClientRejecting(new Error("Worker client disposed.")));
    const onStatus = vi.fn();

    await drawRtstructLayer({
      context: {} as CanvasRenderingContext2D,
      targetCanvas: {} as HTMLCanvasElement,
      viewport: viewport(),
      baseAsset: baseAsset(),
      layer: rtstructLayer(),
      rtstructCache: cache,
      onStatus,
      canvasPoint: () => [0, 0],
      isCurrent: () => false,
    });

    expect(onStatus).not.toHaveBeenCalled();
  });

  it("draws contours on the current slice by patient-space plane when referenced SOP targets another series", async () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const context = canvasContext();
    const onOverlayRenderStatus = vi.fn();
    const cache = createRtstructMetadataCache();
    cache.workerClient = Promise.resolve(workerClientResolving({
      structureCount: 1,
      contourCount: 1,
      pointCount: 4,
      structures: [{
        roiNumber: 1,
        contourCount: 1,
        pointCount: 4,
        contours: [{
          pointCount: 4,
          points: [0, 0, 10.4, 1, 0, 10.4, 1, 1, 10.4, 0, 1, 10.4],
          referencedSopInstanceUids: ["spect-sop-1"],
        }],
      }],
    }));

    await drawRtstructLayer({
      context,
      targetCanvas: {} as HTMLCanvasElement,
      viewport: viewport(),
      baseAsset: baseAsset(),
      layer: { ...rtstructLayer(), rtstructRoiColors: new Map([[1, "#abcdef"]]) },
      rtstructCache: cache,
      onStatus: vi.fn(),
      canvasPoint: () => [0, 0],
      onOverlayRenderStatus,
    });

    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.strokeStyle).toBe("#abcdef");
    expect(onOverlayRenderStatus).toHaveBeenCalledWith({ overlayUid: "rtstruct-1", state: "loading", message: "1 RTSTRUCT file" });
    expect(onOverlayRenderStatus).toHaveBeenLastCalledWith(expect.objectContaining({ overlayUid: "rtstruct-1", state: "visible", contourCount: 1, pointCount: 4, matchMode: "geometry" }));
  });

  it("skips contours for hidden RTSTRUCT ROI numbers", async () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const context = canvasContext();
    const onOverlayRenderStatus = vi.fn();
    const cache = createRtstructMetadataCache();
    cache.workerClient = Promise.resolve(workerClientResolving({
      structureCount: 1,
      contourCount: 1,
      pointCount: 4,
      structures: [{
        roiNumber: 1,
        contourCount: 1,
        pointCount: 4,
        contours: [{
          pointCount: 4,
          points: [0, 0, 10.4, 1, 0, 10.4, 1, 1, 10.4, 0, 1, 10.4],
          referencedSopInstanceUids: ["spect-sop-1"],
        }],
      }],
    }));

    await drawRtstructLayer({
      context,
      targetCanvas: {} as HTMLCanvasElement,
      viewport: viewport(),
      baseAsset: baseAsset(),
      layer: { ...rtstructLayer(), visibleRtstructRoiNumbers: [2] },
      rtstructCache: cache,
      onStatus: vi.fn(),
      canvasPoint: () => [0, 0],
      onOverlayRenderStatus,
    });

    expect(context.stroke).not.toHaveBeenCalled();
    expect(onOverlayRenderStatus).toHaveBeenLastCalledWith(expect.objectContaining({ overlayUid: "rtstruct-1", state: "empty", contourCount: 0, pointCount: 4 }));
  });

  it("does not re-emit loading status for cached RTSTRUCT metadata", async () => {
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    const cache = createRtstructMetadataCache();
    cache.metadataByPath.set("scan1/rtstruct.dcm", Promise.resolve({
      structureCount: 0,
      contourCount: 0,
      pointCount: 0,
      structures: [],
    }));
    const onOverlayRenderStatus = vi.fn();

    await drawRtstructLayer({
      context: canvasContext(),
      targetCanvas: {} as HTMLCanvasElement,
      viewport: viewport(),
      baseAsset: baseAsset(),
      layer: rtstructLayer(),
      rtstructCache: cache,
      onStatus: vi.fn(),
      canvasPoint: () => [0, 0],
      onOverlayRenderStatus,
    });

    expect(onOverlayRenderStatus).not.toHaveBeenCalledWith({ overlayUid: "rtstruct-1", state: "loading" });
    expect(onOverlayRenderStatus).toHaveBeenLastCalledWith({ overlayUid: "rtstruct-1", state: "empty", contourCount: 0 });
  });
});

function workerClientResolving(metadata: Awaited<ReturnType<RtstructContourWorkerClient["readContourMetadata"]>>): RtstructContourWorkerClient {
  return {
    readContourMetadata: vi.fn(async () => metadata),
    dispose: vi.fn(),
  };
}

function workerClientRejecting(error: Error): RtstructContourWorkerClient {
  return {
    readContourMetadata: vi.fn(async () => {
      throw error;
    }),
    dispose: vi.fn(),
  };
}

function viewport(): WorldMappableViewportLike {
  return {
    getCurrentImageIdIndex: () => 0,
    worldToCanvas: () => [0, 0],
  };
}

function baseAsset(): ClinicalViewportAsset {
  return {
    path: "scan1/ct/001.dcm",
    data: new ArrayBuffer(0),
    dicom: {
      sopInstanceUid: "ct-sop-1",
      imagePositionPatient: [0, 0, 10],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [1, 1],
    },
  };
}

function rtstructLayer(): FusionOverlayLayer {
  return {
    label: "Scan1 RTSTRUCT",
    purpose: "rtstruct",
    assets: [{ path: "scan1/rtstruct.dcm", data: new ArrayBuffer(0) }],
    imageIds: [],
    color: "#22c55e",
    opacity: 1,
    overlayUid: "rtstruct-1",
  };
}

function canvasContext(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
