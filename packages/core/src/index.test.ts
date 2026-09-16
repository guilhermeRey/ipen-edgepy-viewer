import { describe, expect, it } from "vitest";
import {
  addOverlay,
  addScan,
  addSeries,
  assembleClinicalStudy,
  buildViewerControlPlaneSnapshot,
  createEmptyStudy,
  normalizeScanId,
  type DicomSeriesRef,
  type OverlayRef,
} from "./index";

describe("clinical core", () => {
  it("creates an empty study without external runtime dependencies", () => {
    expect(createEmptyStudy("study-1", "Demo")).toEqual({
      uid: "study-1",
      label: "Demo",
      series: [],
      overlays: [],
      scans: [],
    });
  });

  it("replaces scans by id immutably", () => {
    const study = addScan(createEmptyStudy("study-1", "Demo"), { id: "scan-1", label: "Scan 1", overlayUids: [] });
    const updated = addScan(study, { id: "scan-1", label: "Scan 1 updated", overlayUids: ["liver"] });

    expect(study.scans[0]?.label).toBe("Scan 1");
    expect(updated.scans).toEqual([{ id: "scan-1", label: "Scan 1 updated", overlayUids: ["liver"] }]);
  });

  it("normalizes scan ids without leaking path formatting into the domain", () => {
    expect(normalizeScanId("scan1")).toBe("Scan1");
    expect(normalizeScanId("Scan 2")).toBe("Scan2");
    expect(normalizeScanId("Baseline")).toBe("Baseline");
  });

  it("assembles CT, functional series and organ/lesion overlays per scan", () => {
    const series: DicomSeriesRef[] = [
      ctSeries({ uid: "scan2-ct", label: "Scan2 CT", scanId: "scan2", instanceCount: 130 }),
      functionalSeries({ uid: "scan2-spect", label: "Scan2 SPECT", scanId: "scan2", instanceCount: 199 }),
      functionalSeries({ uid: "scan1-spect", label: "Scan1 SPECT", scanId: "scan1", instanceCount: 199 }),
      ctSeries({ uid: "scan1-ct", label: "Scan1 CT", scanId: "scan1", instanceCount: 130 }),
    ];
    const overlays: OverlayRef[] = [
      maskOverlay({ uid: "scan1-organs", label: "Scan1 Organs", scanId: "scan1", group: "Organs" }),
      maskOverlay({ uid: "scan1-lesions", label: "Scan1 Lesions", scanId: "scan1", group: "Lesions" }),
      maskOverlay({ uid: "scan2-organs", label: "Scan2 Organs", scanId: "scan2", group: "Organs" }),
      maskOverlay({ uid: "scan2-lesions", label: "Scan2 Lesions", scanId: "scan2", group: "Lesions" }),
    ];

    const study = assembleClinicalStudy({ uid: "synthetic-study", label: "Synthetic Study", series, overlays });

    expect(study.scans).toEqual([
      {
        id: "Scan1",
        label: "Scan1",
        baseSeriesUid: "scan1-ct",
        functionalSeriesUid: "scan1-spect",
        overlayUids: ["scan1-organs", "scan1-lesions"],
      },
      {
        id: "Scan2",
        label: "Scan2",
        baseSeriesUid: "scan2-ct",
        functionalSeriesUid: "scan2-spect",
        overlayUids: ["scan2-organs", "scan2-lesions"],
      },
    ]);
  });

  it("assigns target-linked overlays using the target series scan", () => {
    const study = assembleClinicalStudy({
      uid: "study-1",
      label: "Demo",
      series: [ctSeries({ uid: "scan1-ct", label: "Scan1 CT", scanId: "scan1", instanceCount: 130 })],
      overlays: [{ uid: "liver", label: "Liver", kind: "mask", targetSeriesUid: "scan1-ct" }],
    });

    expect(study.scans[0]?.overlayUids).toEqual(["liver"]);
  });

  it("builds the same scan incrementally or from a batch input", () => {
    const ct = ctSeries({ uid: "scan1-ct", label: "Scan1 CT", scanId: "scan1", instanceCount: 130 });
    const spect = functionalSeries({ uid: "scan1-spect", label: "Scan1 SPECT", scanId: "scan1", instanceCount: 199 });
    const liver = maskOverlay({ uid: "scan1-liver", label: "Scan1 Liver", scanId: "scan1", group: "Organs" });
    const batch = assembleClinicalStudy({ uid: "study-1", label: "Demo", series: [ct, spect], overlays: [liver] });

    const incremental = addOverlay(addSeries(addSeries(createEmptyStudy("study-1", "Demo"), ct), spect), liver);

    expect(incremental).toEqual(batch);
    expect(incremental.scans).toEqual([
      {
        id: "Scan1",
        label: "Scan1",
        baseSeriesUid: "scan1-ct",
        functionalSeriesUid: "scan1-spect",
        overlayUids: ["scan1-liver"],
      },
    ]);
  });

  it("updates incremental study parts by uid without duplicating scans", () => {
    const initial = addSeries(createEmptyStudy("study-1", "Demo"), ctSeries({ uid: "scan1-ct", label: "Scan1 CT", scanId: "scan1", instanceCount: 130 }));
    const updated = addSeries(initial, ctSeries({ uid: "scan1-ct", label: "Scan1 CT updated", scanId: "scan1", instanceCount: 131 }));

    expect(updated.series).toHaveLength(1);
    expect(updated.series[0]?.label).toBe("Scan1 CT updated");
    expect(updated.scans).toHaveLength(1);
    expect(updated.scans[0]?.baseSeriesUid).toBe("scan1-ct");
  });

  it("builds a runtime-free control plane snapshot for Python agents", () => {
    const ct = ctSeries({ uid: "scan1-ct", label: "Scan1 CT", scanId: "scan1", instanceCount: 130 });
    const spect = functionalSeries({ uid: "scan1-spect", label: "Scan1 SPECT", scanId: "scan1", instanceCount: 199 });
    const liver = maskOverlay({ uid: "scan1-liver", label: "Scan1 Liver", scanId: "scan1", group: "Organs" });
    const study = assembleClinicalStudy({ uid: "study-1", label: "Demo", series: [ct, spect], overlays: [liver] });

    const snapshot = buildViewerControlPlaneSnapshot({
      study,
      activeScan: study.scans[0],
      activeSeries: ct,
      baseSeries: ct,
      functionalSeries: spect,
      visibleOverlays: [liver],
      activeSliceIndex: 77,
      sliceCount: 130,
    });

    expect(snapshot).toMatchObject({
      controlPlaneVersion: 1,
      activeScanId: "Scan1",
      activeSeriesUid: "scan1-ct",
      baseSeriesUid: "scan1-ct",
      functionalSeriesUid: "scan1-spect",
      activeSliceIndex: 77,
      sliceCount: 130,
      visibleLayers: [
        { uid: "scan1-spect", label: "Scan1 SPECT", kind: "functional", role: "functional" },
        { uid: "scan1-liver", label: "Scan1 Liver", kind: "mask", role: "overlay" },
      ],
      fusionContext: {
        status: "planned-overlays",
        baseSeriesUid: "scan1-ct",
        functionalSeriesUid: "scan1-spect",
        overlayUids: ["scan1-liver"],
      },
    });
    expect(snapshot.study).toBe(study);
  });
});

interface SeriesInput {
  uid: string;
  label: string;
  scanId: string;
  instanceCount: number;
}

interface MaskOverlayInput {
  uid: string;
  label: string;
  scanId: string;
  group: string;
}

function ctSeries({ uid, label, scanId, instanceCount }: SeriesInput): DicomSeriesRef {
  return { uid, label, scanId, role: "base", modality: "CT", instanceCount };
}

function functionalSeries({ uid, label, scanId, instanceCount }: SeriesInput): DicomSeriesRef {
  return { uid, label, scanId, role: "functional", modality: "PT", instanceCount };
}

function maskOverlay({ uid, label, scanId, group }: MaskOverlayInput): OverlayRef {
  return { uid, label, scanId, group, kind: "mask" };
}
