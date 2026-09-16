export type DicomAssetKind = "image" | "mask" | "rtstruct" | "dose" | "other";

export function classifyDicomPath(path: string): DicomAssetKind {
  const normalized = normalizePath(path);
  if (hasAny(normalized, ["rtstruct", "rt-struct"])) {
    return "rtstruct";
  }
  if (hasAny(normalized, ["rtdose", "dose/", "/dose/", "_dose", "-dose"])) {
    return "dose";
  }
  if (hasAny(normalized, ["/mask/", "/masks/", "/segmentation/", "/segmentations/", "_mask"])) {
    return "mask";
  }
  if (isDicomLikePath(path)) {
    return "image";
  }
  return "other";
}

function hasAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

export function scanIdFromPath(path: string): string | undefined {
  for (const segment of splitPath(path)) {
    const scanId = normalizeScanId(segment);
    if (scanId) {
      return scanId;
    }
  }
  return undefined;
}

export function normalizePath(path: string): string {
  return splitPath(path).join("/").toLowerCase();
}

export function splitPath(path: string): string[] {
  return path.split(/[\\/]+/).filter(Boolean);
}

function isDicomLikePath(path: string): boolean {
  const normalized = normalizePath(path);
  return (
    normalized.endsWith(".dcm") ||
    normalized.endsWith(".dicom") ||
    normalized.endsWith(".ima") ||
    normalized.endsWith("/dicomdir") ||
    normalized === "dicomdir"
  );
}

function normalizeScanId(value: string): string | undefined {
  const match = /^scan\s*(\d+)$/i.exec(value.trim());
  return match ? `Scan${Number(match[1])}` : undefined;
}
