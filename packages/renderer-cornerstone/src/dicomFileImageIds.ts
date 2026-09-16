import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";

export interface DicomFileManager {
  add(file: Blob): string;
  remove(index: number): void;
}

export function createDicomFileImageIds(
  fileManager: DicomFileManager,
  assets: readonly ClinicalViewportAsset[],
): string[] {
  return assets.map((asset) => {
    const blob = asset.data instanceof Blob ? asset.data : new Blob([asset.data], { type: "application/dicom" });
    if (blob.size === 0) {
      throw new Error(`Local DICOM asset is empty: ${asset.path}`);
    }
    return fileManager.add(namedDicomBlob(blob, asset.path));
  });
}

export function removeDicomFileImageIds(fileManager: DicomFileManager, imageIds: readonly string[]): void {
  for (const imageId of imageIds) {
    const index = dicomFileIndex(imageId);
    if (index !== undefined) {
      fileManager.remove(index);
    }
  }
}

function namedDicomBlob(blob: Blob, path: string): Blob {
  if (typeof File !== "function" || blob instanceof File) {
    return blob;
  }
  return new File([blob], path, { type: blob.type || "application/dicom" });
}

function dicomFileIndex(imageId: string): number | undefined {
  if (!imageId.startsWith("dicomfile:")) {
    return undefined;
  }
  const index = Number(imageId.slice("dicomfile:".length));
  return Number.isInteger(index) ? index : undefined;
}
