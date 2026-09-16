import { describe, expect, it } from "vitest";
import {
  buildDicomInventory,
  classifyDicomPath,
  createDicomInventoryFromAssets,
  DicomParserMetadataReader,
  hasSeriesIdentity,
  scanIdFromPath,
  type DicomInventoryEntry,
  type DicomMetadata,
  type DicomMetadataReader,
} from "./index";

describe("DICOM metadata contracts", () => {
  registerMetadataContractTests();
  registerInventoryGroupingTests();
  registerAssetInventoryTests();
  registerAssetInventoryProgressTests();
});

function registerMetadataContractTests(): void {
  it("requires modality and SeriesInstanceUID for series identity", () => {
    expect(hasSeriesIdentity(undefined)).toBe(false);
    expect(hasSeriesIdentity({ transferSyntaxUid: "1.2.840.10008.1.2.1" })).toBe(false);
    expect(hasSeriesIdentity({ modality: "CT", seriesInstanceUid: "series-1" })).toBe(true);
  });

  it("reads clinical metadata with the dicom-parser adapter", async () => {
    const reader = new DicomParserMetadataReader();
    const metadata = await reader.readMetadata(part10DicomBuffer([
      dataElement(0x0008, 0x0018, "UI", "2.25.1001"),
      dataElement(0x0020, 0x000d, "UI", "2.25.1002"),
      dataElement(0x0020, 0x000e, "UI", "2.25.1003"),
      dataElement(0x0008, 0x0060, "CS", "CT"),
      dataElement(0x0020, 0x0052, "UI", "9.8.7"),
      dataElement(0x0020, 0x0013, "IS", "42"),
      dataElement(0x0020, 0x0032, "DS", "1.5\\2.5\\3.5"),
      dataElement(0x0020, 0x0037, "DS", "1\\0\\0\\0\\1\\0"),
      dataElement(0x0028, 0x0030, "DS", "0.976\\0.976"),
    ]));

    expect(metadata).toEqual({
      sopInstanceUid: "2.25.1001",
      studyInstanceUid: "2.25.1002",
      seriesInstanceUid: "2.25.1003",
      modality: "CT",
      frameOfReferenceUid: "9.8.7",
      instanceNumber: 42,
      imagePositionPatient: [1.5, 2.5, 3.5],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      pixelSpacing: [0.976, 0.976],
      transferSyntaxUid: "1.2.840.10008.1.2.1",
    });
    expect(hasSeriesIdentity(metadata)).toBe(true);
  });

  it("returns undefined for invalid DICOM input", async () => {
    const reader = new DicomParserMetadataReader();
    await expect(reader.readMetadata(new Uint8Array([1, 2, 3]).buffer)).resolves.toBeUndefined();
  });

  it("reads Blob metadata without requiring the whole file", async () => {
    const reader = new DicomParserMetadataReader({ initialBlobBytes: 1024, maxBlobBytes: 4096 });
    const blob = new TrackedBlob([part10DicomBuffer([
      dataElement(0x0020, 0x000e, "UI", "blob-series"),
      dataElement(0x0008, 0x0060, "CS", "CT"),
      longDataElement(0x7fe0, 0x0010, "OB", [1, 2, 3, 4]),
    ]), new Uint8Array(1024 * 1024)]);
    const metadata = await reader.readMetadata(blob);

    expect(metadata).toMatchObject({ seriesInstanceUid: "blob-series", modality: "CT" });
    expect(blob.sliceEnds).toEqual([1024]);
  });

  it("classifies image, mask, RTSTRUCT and dose paths", () => {
    expect(classifyDicomPath("Patient/SPECT_CTs/scan1/ct/001.dcm")).toBe("image");
    expect(classifyDicomPath("Patient/SPECT_CTs/scan1/ct/IM0001.IMA")).toBe("image");
    expect(classifyDicomPath("Patient/VOI/scan1/Masks/Organs/liver/001.dcm")).toBe("mask");
    expect(classifyDicomPath("Patient/VOI/scan1/RTstructs/Organs/struct.dcm")).toBe("rtstruct");
    expect(classifyDicomPath("Patient/scan1/rtdose/dose.dcm")).toBe("dose");
    expect(classifyDicomPath("dose/synthetic-dose-maps/patient_gamma-Dose.mhd")).toBe("dose");
    expect(classifyDicomPath("Patient/notes/readme.txt")).toBe("other");
  });

  it("extracts normalized scan ids from paths", () => {
    expect(scanIdFromPath("Patient/SPECT_CTs/scan1/ct/001.dcm")).toBe("Scan1");
    expect(scanIdFromPath("Patient/SCAN 2/spect/001.dcm")).toBe("Scan2");
    expect(scanIdFromPath("Patient/ct/001.dcm")).toBeUndefined();
  });
}

function registerInventoryGroupingTests(): void {
  it("groups image series by scan and SeriesInstanceUID when metadata is ready", () => {
    const inventory = buildDicomInventory([
      imageEntry("Patient/SPECT_CTs/scan1/ct/001.dcm", "Scan1", "CT", "ct-series"),
      imageEntry("Patient/SPECT_CTs/scan1/ct/002.dcm", "Scan1", "CT", "ct-series"),
      imageEntry("Patient/SPECT_CTs/scan1/spect1/001.dcm", "Scan1", "PT", "spect-series"),
    ]);

    expect(inventory).toMatchObject([
      {
        kind: "image",
        scanId: "Scan1",
        modality: "CT",
        instanceCount: 2,
        metadataReadyCount: 2,
        metadataMissingCount: 0,
      },
      {
        kind: "image",
        scanId: "Scan1",
        modality: "PT",
        instanceCount: 1,
        metadataReadyCount: 1,
        metadataMissingCount: 0,
      },
    ]);
  });

  it("orders image instances by patient-space slice position before path", () => {
    const inventory = buildDicomInventory([
      imageEntryWithGeometry("Patient/SPECT_CTs/scan1/ct/slice-z10.dcm", "Scan1", "CT", "ct-series", 10),
      imageEntryWithGeometry("Patient/SPECT_CTs/scan1/ct/slice-z00.dcm", "Scan1", "CT", "ct-series", 0),
      imageEntryWithGeometry("Patient/SPECT_CTs/scan1/ct/slice-z05.dcm", "Scan1", "CT", "ct-series", 5),
    ]);

    expect(inventory[0]?.paths).toEqual([
      "Patient/SPECT_CTs/scan1/ct/slice-z00.dcm",
      "Patient/SPECT_CTs/scan1/ct/slice-z05.dcm",
      "Patient/SPECT_CTs/scan1/ct/slice-z10.dcm",
    ]);
  });

  it("falls back to InstanceNumber when patient-space position is unavailable", () => {
    const inventory = buildDicomInventory([
      imageEntryWithInstance("Patient/SPECT_CTs/scan1/ct/b.dcm", "Scan1", "CT", "ct-series", 2),
      imageEntryWithInstance("Patient/SPECT_CTs/scan1/ct/a.dcm", "Scan1", "CT", "ct-series", 1),
    ]);

    expect(inventory[0]?.paths).toEqual([
      "Patient/SPECT_CTs/scan1/ct/a.dcm",
      "Patient/SPECT_CTs/scan1/ct/b.dcm",
    ]);
  });

  it("keeps metadata-insufficient images visible as a fallback inventory group", () => {
    const inventory = buildDicomInventory([
      imageEntry("Patient/SPECT_CTs/scan1/ct/001.dcm", "Scan1", "CT", "ct-series"),
      {
        path: "Patient/SPECT_CTs/scan1/ct/002.dcm",
        kind: "image",
        scanId: "Scan1",
        metadata: { transferSyntaxUid: "1.2.840.10008.1.2.1" },
      },
    ]);

    expect(inventory).toHaveLength(2);
    expect(inventory[1]).toMatchObject({
      key: "image:Scan1:Patient/SPECT_CTs/scan1/ct",
      instanceCount: 1,
      metadataReadyCount: 0,
      metadataMissingCount: 1,
    });
  });

  it("groups masks separately from image series", () => {
    const inventory = buildDicomInventory([
      { path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan1" },
      { path: "Patient/VOI/scan1/Masks/Organs/liver/002.dcm", kind: "mask", scanId: "Scan1" },
      { path: "Patient/VOI/scan1/Masks/Lesions/lesion1/001.dcm", kind: "mask", scanId: "Scan1" },
    ]);

    expect(inventory).toMatchObject([
      { kind: "mask", scanId: "Scan1", instanceCount: 1 },
      { kind: "mask", scanId: "Scan1", instanceCount: 2 },
    ]);
  });

  it("groups MHD/RAW dose pairs as separate overlays", () => {
    const inventory = buildDicomInventory([
      { path: "dose/result/patient_beta--Dose.mhd", kind: "dose" },
      { path: "dose/result/patient_beta--Dose.raw", kind: "dose" },
      { path: "dose/result/patient_gamma-Dose.mhd", kind: "dose" },
      { path: "dose/result/patient_gamma-Dose.raw", kind: "dose" },
    ]);

    expect(inventory).toMatchObject([
      { kind: "dose", key: "dose:unknown-scan:dose/result/patient_beta--Dose", instanceCount: 2 },
      { kind: "dose", key: "dose:unknown-scan:dose/result/patient_gamma-Dose", instanceCount: 2 },
    ]);
  });
}

function registerAssetInventoryTests(): void {
  it("creates inventory entries and series from assets using a metadata reader", async () => {
    const reader = new MapMetadataReader({
      "Patient/SPECT_CTs/scan1/ct/001.dcm": { modality: "CT", seriesInstanceUid: "ct-series" },
      "Patient/SPECT_CTs/scan1/ct/002.dcm": { modality: "CT", seriesInstanceUid: "ct-series" },
      "Patient/VOI/scan1/Masks/Organs/liver/001.dcm": undefined,
    });

    const result = await createDicomInventoryFromAssets(
      [
        asset("Patient/SPECT_CTs/scan1/ct/001.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/002.dcm"),
        asset("Patient/VOI/scan1/Masks/Organs/liver/001.dcm"),
        asset("Patient/notes/readme.txt"),
      ],
      reader,
    );

    expect(reader.readPaths).toEqual([
      "Patient/SPECT_CTs/scan1/ct/001.dcm",
      "Patient/SPECT_CTs/scan1/ct/002.dcm",
    ]);
    expect(result.entries).toMatchObject([
      {
        path: "Patient/SPECT_CTs/scan1/ct/001.dcm",
        kind: "image",
        scanId: "Scan1",
        metadata: { modality: "CT", seriesInstanceUid: "ct-series" },
      },
      {
        path: "Patient/SPECT_CTs/scan1/ct/002.dcm",
        kind: "image",
        scanId: "Scan1",
        metadata: { modality: "CT", seriesInstanceUid: "ct-series" },
      },
      { path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan1" },
      { path: "Patient/notes/readme.txt", kind: "other" },
    ]);
    expect(result.series).toMatchObject([
      {
        kind: "image",
        scanId: "Scan1",
        modality: "CT",
        instanceCount: 2,
        metadataReadyCount: 2,
        metadataMissingCount: 0,
      },
      {
        kind: "mask",
        scanId: "Scan1",
        instanceCount: 1,
        metadataReadyCount: 0,
        metadataMissingCount: 1,
      },
    ]);
  });

  it("infers extensionless DICOM image files from metadata", async () => {
    const result = await createDicomInventoryFromAssets(
      [{ path: "Patient/SPECT_CTs/scan1/ct/IM0001", data: part10DicomBuffer([
        dataElement(0x0020, 0x000e, "UI", "extensionless-series"),
        dataElement(0x0008, 0x0060, "CS", "CT"),
      ]) }],
      new DicomParserMetadataReader(),
      { metadataKinds: ["image", "other"] },
    );

    expect(result.entries).toMatchObject([
      { path: "Patient/SPECT_CTs/scan1/ct/IM0001", kind: "image", scanId: "Scan1" },
    ]);
    expect(result.series).toMatchObject([
      { kind: "image", scanId: "Scan1", modality: "CT", instanceCount: 1 },
    ]);
  });

  it("can opt into reading metadata for non-image assets", async () => {
    const reader = new MapMetadataReader({
      "Patient/VOI/scan1/Masks/Organs/liver/001.dcm": { modality: "SEG", seriesInstanceUid: "mask-series" },
    });

    await createDicomInventoryFromAssets(
      [asset("Patient/VOI/scan1/Masks/Organs/liver/001.dcm")],
      reader,
      { metadataKinds: ["image", "mask"] },
    );

    expect(reader.readPaths).toEqual(["Patient/VOI/scan1/Masks/Organs/liver/001.dcm"]);
  });

  it("keeps non-image assets visible without posting file data to the worker", async () => {
    const reader = new MapMetadataReader({});

    const result = await createDicomInventoryFromAssets(
      [{ path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm" }],
      reader,
    );

    expect(reader.readPaths).toEqual([]);
    expect(result.entries).toMatchObject([
      { path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan1" },
    ]);
    expect(result.series).toMatchObject([
      { kind: "mask", scanId: "Scan1", instanceCount: 1 },
    ]);
  });

  it("keeps assets visible when metadata reader throws", async () => {
    const reader: DicomMetadataReader = {
      id: "throwing-reader",
      async readMetadata() {
        throw new Error("metadata read failed");
      },
    };

    const result = await createDicomInventoryFromAssets(
      [asset("Patient/SPECT_CTs/scan1/ct/001.dcm")],
      reader,
    );

    expect(result.entries).toMatchObject([
      { path: "Patient/SPECT_CTs/scan1/ct/001.dcm", kind: "image", scanId: "Scan1" },
    ]);
    expect(result.series).toMatchObject([
      { key: "image:Scan1:Patient/SPECT_CTs/scan1/ct", metadataMissingCount: 1 },
    ]);
  });
}

function registerAssetInventoryProgressTests(): void {
  it("limits metadata reads and reports progress", async () => {
    const reader = new SlowMetadataReader();
    const progress: number[] = [];

    await createDicomInventoryFromAssets(
      [
        asset("Patient/SPECT_CTs/scan1/ct/001.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/002.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/003.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/004.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/005.dcm"),
      ],
      reader,
      { concurrency: 2, onProgress: ({ completed }) => progress.push(completed) },
    );

    expect(reader.maxActive).toBeLessThanOrEqual(2);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
  });

  it("can reduce progress notifications for large imports", async () => {
    const reader = new SlowMetadataReader();
    const progress: number[] = [];

    await createDicomInventoryFromAssets(
      [
        asset("Patient/SPECT_CTs/scan1/ct/001.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/002.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/003.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/004.dcm"),
        asset("Patient/SPECT_CTs/scan1/ct/005.dcm"),
      ],
      reader,
      { concurrency: 2, progressInterval: 2, onProgress: ({ completed }) => progress.push(completed) },
    );

    expect(progress).toEqual([2, 4, 5]);
  });

  it("aborts inventory creation before reading assets", async () => {
    const reader = new MapMetadataReader({
      "Patient/SPECT_CTs/scan1/ct/001.dcm": { modality: "CT", seriesInstanceUid: "ct-series" },
    });
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      createDicomInventoryFromAssets([asset("Patient/SPECT_CTs/scan1/ct/001.dcm")], reader, {
        signal: abortController.signal,
      }),
    ).rejects.toThrow("Import cancelled.");
    expect(reader.readPaths).toEqual([]);
  });
}

function imageEntry(...[path, scanId, modality, seriesInstanceUid]: [string, string, string, string]): DicomInventoryEntry {
  return {
    path,
    kind: "image",
    scanId,
    metadata: { modality, seriesInstanceUid },
  };
}

function imageEntryWithGeometry(...[path, scanId, modality, seriesInstanceUid, z]: [string, string, string, string, number]): DicomInventoryEntry {
  return {
    path,
    kind: "image",
    scanId,
    metadata: {
      modality,
      seriesInstanceUid,
      imagePositionPatient: [0, 0, z],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
    },
  };
}

function imageEntryWithInstance(...[path, scanId, modality, seriesInstanceUid, instanceNumber]: [string, string, string, string, number]): DicomInventoryEntry {
  return {
    path,
    kind: "image",
    scanId,
    metadata: { modality, seriesInstanceUid, instanceNumber },
  };
}

class MapMetadataReader implements DicomMetadataReader {
  readonly id = "map-reader";
  readonly readPaths: string[] = [];

  constructor(private readonly metadataByPath: Record<string, DicomMetadata | undefined>) {}

  async readMetadata(input: ArrayBuffer | Blob): Promise<DicomMetadata | undefined> {
    if (input instanceof Blob) {
      return undefined;
    }
    const path = pathFromBuffer(input);
    this.readPaths.push(path);
    return this.metadataByPath[path];
  }
}

class SlowMetadataReader implements DicomMetadataReader {
  readonly id = "slow-reader";
  active = 0;
  maxActive = 0;

  async readMetadata(): Promise<DicomMetadata | undefined> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.active -= 1;
    return { modality: "CT", seriesInstanceUid: "series" };
  }
}

function asset(path: string): { path: string; data: ArrayBuffer } {
  return { path, data: bufferFromPath(path) };
}

function bufferFromPath(path: string): ArrayBuffer {
  return new TextEncoder().encode(path).buffer as ArrayBuffer;
}

function pathFromBuffer(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

function part10DicomBuffer(dataSetElements: readonly number[][]): ArrayBuffer {
  const transferSyntax = dataElement(0x0002, 0x0010, "UI", "1.2.840.10008.1.2.1");
  const fileMetaGroupLength = groupLengthElement(transferSyntax.length);
  return toArrayBuffer([
    ...new Array(128).fill(0),
    ...ascii("DICM"),
    ...fileMetaGroupLength,
    ...transferSyntax,
    ...dataSetElements.flat(),
  ]);
}

function dataElement(...[group, element, vr, value]: [number, number, string, string]): number[] {
  const valueBytes = ascii(value);
  const paddedValue = valueBytes.length % 2 === 0 ? valueBytes : [...valueBytes, vr === "UI" ? 0 : 32];
  return [...uint16(group), ...uint16(element), ...ascii(vr), ...uint16(paddedValue.length), ...paddedValue];
}

function longDataElement(...[group, element, vr, value]: [number, number, string, readonly number[]]): number[] {
  const paddedValue = value.length % 2 === 0 ? [...value] : [...value, 0];
  return [...uint16(group), ...uint16(element), ...ascii(vr), 0, 0, ...uint32(paddedValue.length), ...paddedValue];
}

function groupLengthElement(length: number): number[] {
  return [...uint16(0x0002), ...uint16(0x0000), ...ascii("UL"), ...uint16(4), ...uint32(length)];
}

function ascii(value: string): number[] {
  return Array.from(value, (char) => char.charCodeAt(0));
}

function uint16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function uint32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
}

function toArrayBuffer(bytes: readonly number[]): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer;
}

class TrackedBlob extends Blob {
  readonly sliceEnds: number[] = [];

  slice(start?: number, end?: number, contentType?: string): Blob {
    this.sliceEnds.push(end ?? this.size);
    return super.slice(start, end, contentType);
  }
}
