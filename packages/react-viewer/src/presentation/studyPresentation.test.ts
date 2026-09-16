import { describe, expect, it } from "vitest";
import type { ClinicalStudy, DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import {
  groupOverlaysByGroup,
  functionalOverlayOpacity,
  functionalOverlayColormap,
  functionalOverlayColormapLabel,
  overlayOpacity,
  overlayColor,
  overlayToggleActionLabel,
  overlayVisibilityLabel,
  renderableOverlays,
  rtstructReferenceOverlays,
} from "./overlayPresentation";
import { overlayGroupLabel, overlaysForScan, selectedSeriesForScan, seriesForScan } from "./studyPresentation";

describe("study presentation", () => {
  it("orders scan series by clinical role", () => {
    const study = studyWith([
      series("spect", "Scan1 SPECT", "functional"),
      series("ct", "Scan1 CT", "base"),
      series("unknown", "Scan1 Unknown", "unknown"),
    ]);

    expect(seriesForScan(study, study.scans[0]).map((item) => item.uid)).toEqual(["ct", "spect", "unknown"]);
  });

  it("falls back to the scan base series when the selection is outside the scan", () => {
    const study = studyWith([series("ct", "Scan1 CT", "base"), series("spect", "Scan1 SPECT", "functional")]);

    expect(selectedSeriesForScan(study, study.scans[0], "outside")?.uid).toBe("ct");
  });

  it("returns overlays and display labels for a scan", () => {
    const organ: OverlayRef = { uid: "liver", label: "Liver", scanId: "Scan1", kind: "mask", group: "Organs", structure: "liver" };
    const lesion: OverlayRef = { uid: "lesion", label: "Lesion", scanId: "Scan2", kind: "mask" };
    const study = { ...studyWith([series("ct", "Scan1 CT", "base")]), overlays: [organ, lesion] };

    expect(overlaysForScan(study.overlays, study.scans[0])).toEqual([organ]);
    expect(overlayGroupLabel(organ)).toBe("Organs / liver");
  });

  it("groups overlays and assigns stable presentation colors", () => {
    const organ: OverlayRef = { uid: "liver", label: "Liver", kind: "mask", group: "Organs", structure: "liver" };
    const lesion: OverlayRef = { uid: "lesion", label: "Lesion", kind: "mask", group: "Lesions", structure: "tumor" };
    const dose: OverlayRef = { uid: "dose", label: "Dose", kind: "dose", group: "Dose" };

    expect(groupOverlaysByGroup([organ, lesion, dose]).map((group) => group.key)).toEqual(["Organs", "Lesions", "Dose"]);
    expect(overlayColor(organ, 0)).toBe("#22c55e");
    expect(overlayColor(lesion, 1)).toBe("#f97316");
    expect(overlayColor(dose, 2)).toBe("#ef4444");
  });

  it("keeps fallback overlay colors stable when active overlays change", () => {
    const first: OverlayRef = { uid: "first", label: "First", kind: "mask", group: "Other", structure: "first" };
    const second: OverlayRef = { uid: "second", label: "Second", kind: "mask", group: "Other", structure: "second" };

    expect(overlayColor(first, 0)).toBe(overlayColor(first, 1));
    expect(overlayColor(second, 0)).toBe(overlayColor(second, 1));
  });

  it("resolves and clamps overlay opacity", () => {
    const mask: OverlayRef = { uid: "liver", label: "Liver", kind: "mask" };
    const dose: OverlayRef = { uid: "dose", label: "Dose", kind: "dose" };
    const custom: OverlayRef = { uid: "custom", label: "Custom", kind: "mask", metadata: { opacity: 1.4 } };

    expect(overlayOpacity(mask)).toBe(0.65);
    expect(overlayOpacity(dose)).toBe(0.65);
    expect(overlayOpacity(custom)).toBe(1);
    expect(functionalOverlayOpacity(-0.2)).toBe(0);
    expect(functionalOverlayOpacity(undefined)).toBe(0.55);
  });

  it("resolves functional colormap presets", () => {
    expect(functionalOverlayColormap("viridis")).toBe("viridis");
    expect(functionalOverlayColormap("unknown")).toBe("heat");
    expect(functionalOverlayColormapLabel("grayscale")).toBe("Grayscale");
  });

  it("describes overlay visibility actions", () => {
    const overlay: OverlayRef = { uid: "liver", label: "Liver", kind: "mask" };

    expect(overlayVisibilityLabel(true)).toBe("Visible");
    expect(overlayVisibilityLabel(false)).toBe("Hidden");
    expect(overlayToggleActionLabel(overlay, true)).toBe("Hide Liver");
    expect(overlayToggleActionLabel(overlay, false)).toBe("Show Liver");
  });

  it("separates renderable overlays from RTSTRUCT references", () => {
    const mask: OverlayRef = { uid: "liver", label: "Liver", kind: "mask" };
    const rtstruct: OverlayRef = { uid: "rt", label: "RTSTRUCT", kind: "rtstruct" };

    expect(renderableOverlays([mask, rtstruct])).toEqual([mask]);
    expect(rtstructReferenceOverlays([mask, rtstruct])).toEqual([rtstruct]);
  });
});

function studyWith(seriesItems: DicomSeriesRef[]): ClinicalStudy {
  return {
    uid: "study",
    label: "Study",
    series: seriesItems,
    overlays: [],
    scans: [{ id: "Scan1", label: "Scan1", baseSeriesUid: "ct", functionalSeriesUid: "spect", overlayUids: ["liver"] }],
  };
}

function series(uid: string, label: string, role: DicomSeriesRef["role"]): DicomSeriesRef {
  return { uid, label, role, scanId: "Scan1", instanceCount: 2 };
}
