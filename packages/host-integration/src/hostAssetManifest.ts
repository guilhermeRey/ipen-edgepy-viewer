export interface HostAsset {
  path: string;
  url?: string | undefined;
  kind?: "archive" | "dicom" | "mask" | "rtstruct" | "dose" | "other" | undefined;
  contentType?: string | undefined;
  size?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface HostAssetManifest {
  studyUid?: string | undefined;
  label?: string | undefined;
  assets: HostAsset[];
  metadata?: Record<string, unknown> | undefined;
}

export type HostSeriesRole = "base" | "functional" | "dose" | "unknown";

export type HostOverlayKind = "mask" | "rtstruct" | "dose" | "derived";

export interface HostAddSeriesCommand {
  type: "add-series";
  seriesUid: string;
  label: string;
  role: HostSeriesRole;
  scanId?: string;
  modality?: string;
  assets: HostAsset[];
  metadata?: Record<string, unknown>;
}

export interface HostAddOverlayCommand {
  type: "add-overlay";
  overlayUid: string;
  label: string;
  kind: HostOverlayKind;
  scanId?: string;
  targetSeriesUid?: string;
  group?: string;
  structure?: string;
  assets: HostAsset[];
  metadata?: Record<string, unknown>;
}

export interface HostReplaceStudyCommand {
  type: "replace-study";
  manifest: HostAssetManifest;
}

export interface HostClearStudyCommand {
  type: "clear-study";
}

export type HostStudyCommand =
  | HostAddSeriesCommand
  | HostAddOverlayCommand
  | HostReplaceStudyCommand
  | HostClearStudyCommand;

export function normalizeLogicalPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "").trim();
  if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "..")) {
    throw new Error(`Invalid host asset logical path: ${path}`);
  }
  return normalized;
}

export function normalizeHostStudyCommand(command: HostStudyCommand): HostStudyCommand {
  if (command.type === "add-series" || command.type === "add-overlay") {
    return { ...command, assets: command.assets.map(normalizeHostAsset) };
  }
  if (command.type === "replace-study") {
    return {
      ...command,
      manifest: { ...command.manifest, assets: command.manifest.assets.map(normalizeHostAsset) },
    };
  }
  return command;
}

function normalizeHostAsset(asset: HostAsset): HostAsset {
  return { ...asset, path: normalizeLogicalPath(asset.path) };
}
