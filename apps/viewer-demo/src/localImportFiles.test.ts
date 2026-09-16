import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { assetInputFromFile, filesFromFileList } from "./localImportFiles";

describe("local import files", () => {
  it("expands zip entries using the archive path", async () => {
    const file = await zipFile("Synthetic_Study/SPECT_Cts/scan1/ct.zip", {
      "ct/1.dcm": "dicom-1",
      "ct/2.dcm": "dicom-2",
      "__MACOSX/ignored.dcm": "ignored",
      ".DS_Store": "ignored",
    });

    const files = await filesFromFileList(fileListFrom([file]));

    expect(files.map((entry) => entry.path)).toEqual([
      "Synthetic_Study/SPECT_Cts/scan1/ct/1.dcm",
      "Synthetic_Study/SPECT_Cts/scan1/ct/2.dcm",
    ]);
  });

  it("keeps mask zip blobs for overlay geometry while inventory can parse them", async () => {
    const file = await zipFile("Synthetic_Study/VOI/scan1/Masks/Lesions/lesion1.zip", {
      "1.dcm": "mask-slice",
    });

    const [entry] = await filesFromFileList(fileListFrom([file]));
    const asset = assetInputFromFile(entry);

    expect(asset.path).toBe("Synthetic_Study/VOI/scan1/Masks/Lesions/lesion1/1.dcm");
    expect(entry.file).toBeInstanceOf(Blob);
    expect(asset.data).toBeInstanceOf(Blob);
  });

  it("keeps uppercase IMA and extensionless DICOM blobs for metadata import", async () => {
    const ima = new File(["dicom-ima"], "IM0001.IMA");
    Object.defineProperty(ima, "webkitRelativePath", { value: "Patient/Scan1/CT/IM0001.IMA" });
    const extensionless = new File(["dicom-extensionless"], "IM0002");
    Object.defineProperty(extensionless, "webkitRelativePath", { value: "Patient/Scan1/CT/IM0002" });

    const files = await filesFromFileList(fileListFrom([ima, extensionless]));
    const assets = files.map(assetInputFromFile);

    expect(files.map((entry) => entry.path)).toEqual(["Patient/Scan1/CT/IM0001.IMA", "Patient/Scan1/CT/IM0002"]);
    expect(assets.every((asset) => asset.data instanceof Blob)).toBe(true);
  });

  it("keeps RTSTRUCT zip blobs for contour metadata", async () => {
    const file = await zipFile("Synthetic_Study/VOI/scan1/RTstructs/Organs/liver.zip", {
      "liver.dcm": "rtstruct",
    });

    const [entry] = await filesFromFileList(fileListFrom([file]));
    const asset = assetInputFromFile(entry);

    expect(asset.path).toBe("Synthetic_Study/VOI/scan1/RTstructs/Organs/liver/liver.dcm");
    expect(entry.file).toBeInstanceOf(Blob);
    expect(asset.data).toBeInstanceOf(Blob);
  });

  it("keeps dose MHD/RAW zip blobs for overlay rendering", async () => {
    const file = await zipFile("dose/synthetic-dose-maps.zip", {
      "patient_gamma-Dose.mhd": "mhd",
      "patient_gamma-Dose.raw": "raw",
    });

    const files = await filesFromFileList(fileListFrom([file]));
    const assets = files.map(assetInputFromFile);

    expect(files.map((entry) => entry.path)).toEqual([
      "dose/synthetic-dose-maps/patient_gamma-Dose.mhd",
      "dose/synthetic-dose-maps/patient_gamma-Dose.raw",
    ]);
    expect(files.every((entry) => entry.file instanceof Blob)).toBe(true);
    expect(assets.every((asset) => asset.data instanceof Blob)).toBe(true);
  });

  it("ignores selected system files before import", async () => {
    const dicom = new File(["dicom"], "001.dcm");
    Object.defineProperty(dicom, "webkitRelativePath", { value: "Patient/Scan1/CT/001.dcm" });
    const dsStore = new File(["metadata"], ".DS_Store");
    Object.defineProperty(dsStore, "webkitRelativePath", { value: "Patient/Scan1/.DS_Store" });

    const files = await filesFromFileList(fileListFrom([dicom, dsStore]));

    expect(files.map((entry) => entry.path)).toEqual(["Patient/Scan1/CT/001.dcm"]);
  });
});

async function zipFile(path: string, entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [entryPath, content] of Object.entries(entries)) {
    zip.file(entryPath, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const file = new File([blob], path.split("/").at(-1) ?? "archive.zip", { type: "application/zip" });
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

function fileListFrom(files: readonly File[]): FileList {
  return files as unknown as FileList;
}
