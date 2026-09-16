import { assembleClinicalStudy } from "@pycom-next/core";
import { describe, expect, it } from "vitest";
import {
  buildDicomInventory,
  createClinicalStudyInputFromDicomInventory,
  type DicomInventoryEntry,
} from "./index";

describe("DICOM inventory to clinical study mapping", () => {
  it("maps CT, functional series and masks into core study input", () => {
    const entries: DicomInventoryEntry[] = [
      imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/001.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "ct-series" }),
      imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/002.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "ct-series" }),
      imageEntry({ path: "Patient/SPECT_CTs/scan1/spect/001.dcm", scanId: "Scan1", modality: "NM", seriesInstanceUid: "spect-series" }),
      { path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan1" },
      { path: "Patient/VOI/scan1/Masks/Lesions/lesion1/001.dcm", kind: "mask", scanId: "Scan1" },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "synthetic-study", label: "Synthetic Study" },
    );
    const study = assembleClinicalStudy(input);

    expectMappedStudy(input, study);
  });

  it("maps RTSTRUCT entries as target-linked overlays", () => {
    const entries: DicomInventoryEntry[] = [
      imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/001.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "ct-series" }),
      {
        path: "Patient/VOI/scan1/RTstructs/Organs/liver.dcm",
        kind: "rtstruct",
        scanId: "Scan1",
        metadata: { modality: "RTSTRUCT", rtstruct: { structureCount: 1, contourCount: 2, pointCount: 8, structures: [{ roiNumber: 1, name: "Liver", contourCount: 2, pointCount: 8 }] } },
      },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "synthetic-study", label: "Synthetic Study" },
    );

    expect(input.overlays).toMatchObject([
      {
        kind: "rtstruct",
        scanId: "Scan1",
        targetSeriesUid: input.series?.[0]?.uid,
        group: "Organs",
        structure: "Liver",
        label: "Scan1 RTSTRUCT Liver",
        metadata: {
          dicom: {
            modality: "RTSTRUCT",
            rtstruct: { structureCount: 1, contourCount: 2, pointCount: 8, structures: [{ roiNumber: 1, name: "Liver", contourCount: 2, pointCount: 8 }] },
          },
        },
      },
    ]);
  });

  it("uses RTSTRUCT ROI names instead of UID-like filenames", () => {
    const entries: DicomInventoryEntry[] = [
      imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/001.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "ct-series" }),
      {
        path: "Patient/VOI/scan1/RTstructs/Organs/2.16.840.1.114365.dcm",
        kind: "rtstruct",
        scanId: "Scan1",
        metadata: { modality: "RTSTRUCT", rtstruct: { structureCount: 1, contourCount: 2, pointCount: 8, structures: [{ roiNumber: 1, name: "Liver", contourCount: 2, pointCount: 8 }] } },
      },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "synthetic-study", label: "Synthetic Study" },
    );

    expect(input.overlays?.[0]).toMatchObject({ structure: "Liver", label: "Scan1 RTSTRUCT Liver" });
  });

  it("uses DICOM series descriptions in image labels", () => {
    const entries: DicomInventoryEntry[] = [
      {
        path: "Patient/SPECT_CTs/scan1/ct/001.dcm",
        kind: "image",
        scanId: "Scan1",
        metadata: { modality: "CT", seriesInstanceUid: "ct-series", seriesDescription: "Planning CT" },
      },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "synthetic-study", label: "Synthetic Study" },
    );

    expect(input.series?.[0]?.label).toBe("Scan1 Planning CT");
  });

  it("maps mammography IMA images without scan folders as a renderable base scan", () => {
    const entries: DicomInventoryEntry[] = [
      {
        path: "SYNTHETIC_2_0.MG.QC-PROCESSED.0002.0003.2000.01.01.00.00.00.000000.0000000.IMA",
        kind: "image",
        metadata: { modality: "MG", seriesInstanceUid: "2.25.999999999999999999999999999999999999" },
      },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "mg-study", label: "MG study" },
    );
    const study = assembleClinicalStudy(input);

    expect(input.series).toMatchObject([{ role: "base", modality: "MG", instanceCount: 1 }]);
    expect(study.scans).toEqual([{ id: "Study", label: "Study", baseSeriesUid: input.series?.[0]?.uid, overlayUids: [] }]);
  });

  it("maps MHD/RAW dose paths to readable dose overlays", () => {
    const entries: DicomInventoryEntry[] = [
      imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/001.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "ct-series" }),
      { path: "dose/synthetic-dose-maps/sample_beta--Dose.mhd", kind: "dose" },
      { path: "dose/synthetic-dose-maps/sample_beta--Dose.raw", kind: "dose" },
      { path: "dose/synthetic-dose-maps/sample_gamma-Dose.mhd", kind: "dose" },
      { path: "dose/synthetic-dose-maps/sample_gamma-Dose.raw", kind: "dose" },
    ];

    const input = createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "synthetic-study", label: "Synthetic Study" },
    );

    expect(input.overlays).toMatchObject([
      { kind: "dose", group: "Dose", structure: "Sample beta dose", label: "Sample beta dose" },
      { kind: "dose", group: "Dose", structure: "Sample gamma dose", label: "Sample gamma dose" },
    ]);
  });
});

interface ImageEntryInput {
  path: string;
  scanId: string;
  modality: string;
  seriesInstanceUid: string;
}

function expectMappedStudy(input: ReturnType<typeof createClinicalStudyInputFromDicomInventory>, study: ReturnType<typeof assembleClinicalStudy>): void {
  expectMappedSeries(input);
  expectMappedOverlays(input);
  expectMappedScans(input, study);
}

function expectMappedSeries(input: ReturnType<typeof createClinicalStudyInputFromDicomInventory>): void {
  expect(input.series).toMatchObject([
    { role: "base", modality: "CT", scanId: "Scan1", instanceCount: 2 },
    { role: "functional", modality: "NM", scanId: "Scan1", instanceCount: 1 },
  ]);
  expect(input.series?.[0]?.metadata?.instances).toEqual([
    {
      path: "Patient/SPECT_CTs/scan1/ct/001.dcm",
      dicom: { modality: "CT", seriesInstanceUid: "ct-series", instanceNumber: 1 },
    },
    {
      path: "Patient/SPECT_CTs/scan1/ct/002.dcm",
      dicom: { modality: "CT", seriesInstanceUid: "ct-series", instanceNumber: 2 },
    },
  ]);
}

function expectMappedOverlays(input: ReturnType<typeof createClinicalStudyInputFromDicomInventory>): void {
  expect(input.overlays).toMatchObject([
    {
      kind: "mask",
      scanId: "Scan1",
      targetSeriesUid: input.series?.[0]?.uid,
      group: "Lesions",
      structure: "lesion1",
    },
    {
      kind: "mask",
      scanId: "Scan1",
      targetSeriesUid: input.series?.[0]?.uid,
      group: "Organs",
      structure: "liver",
    },
  ]);
}

function expectMappedScans(input: ReturnType<typeof createClinicalStudyInputFromDicomInventory>, study: ReturnType<typeof assembleClinicalStudy>): void {
  expect(study.scans).toEqual([
    {
      id: "Scan1",
      label: "Scan1",
      baseSeriesUid: input.series?.[0]?.uid,
      functionalSeriesUid: input.series?.[1]?.uid,
      overlayUids: input.overlays?.map((overlay) => overlay.uid),
    },
  ]);
}

function imageEntry({ path, scanId, modality, seriesInstanceUid }: ImageEntryInput): DicomInventoryEntry {
  const instanceNumber = instanceNumberFromPath(path);
  return {
    path,
    kind: "image",
    scanId,
    metadata: { modality, seriesInstanceUid, ...(instanceNumber !== undefined ? { instanceNumber } : {}) },
  };
}

function instanceNumberFromPath(path: string): number | undefined {
  const filename = path.split("/").at(-1) ?? "";
  const stem = filename.endsWith(".dcm") ? filename.slice(0, -4) : "";
  return stem && Number.isInteger(Number(stem)) ? Number(stem) : undefined;
}
