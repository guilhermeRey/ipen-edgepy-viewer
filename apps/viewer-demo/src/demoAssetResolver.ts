import type { DicomSeriesRef, OverlayRef } from "@pycom-next/core";
import type { ClinicalViewportAsset, ClinicalViewportAssetResolver } from "@pycom-next/react-viewer";

export const demoAssetResolver: ClinicalViewportAssetResolver = {
  resolveSeriesAssets(series) {
    return assetRefsFromMetadata(series).map(syntheticAssetFromRef);
  },
  resolveOverlayAssets(overlay) {
    return assetRefsFromMetadata(overlay).map(syntheticAssetFromRef);
  },
};

export function createDemoAssetResolver(assetByPath: ReadonlyMap<string, Blob>): ClinicalViewportAssetResolver {
  return {
    resolveSeriesAssets(series) {
      return assetRefsFromMetadata(series).flatMap((ref) => assetFromRef(ref, assetByPath));
    },
    resolveOverlayAssets(overlay) {
      return assetRefsFromMetadata(overlay).flatMap((ref) => assetFromRef(ref, assetByPath));
    },
  };
}

interface AssetRef {
  path: string;
  dicom?: ClinicalViewportAsset["dicom"];
}

function assetFromRef(ref: AssetRef, assetByPath: ReadonlyMap<string, Blob>): ClinicalViewportAsset[] {
  const data = assetByPath.get(ref.path);
  return data ? [{ path: ref.path, data, ...(ref.dicom ? { dicom: ref.dicom } : {}) }] : [];
}

function syntheticAssetFromRef(ref: AssetRef): ClinicalViewportAsset {
  return {
    path: ref.path,
    data: new Blob([ref.path], { type: "application/dicom" }),
    ...(ref.dicom ? { dicom: ref.dicom } : {}),
  };
}

function assetRefsFromMetadata(item: DicomSeriesRef | OverlayRef): AssetRef[] {
  const path = item.metadata?.path;
  const paths = item.metadata?.paths;
  const instances = item.metadata?.instances;
  if (Array.isArray(instances)) {
    return instances.flatMap(assetRefFromInstance);
  }
  if (typeof path === "string") {
    return [{ path, ...(dicomFromUnknown(item.metadata?.dicom) ? { dicom: dicomFromUnknown(item.metadata?.dicom) } : {}) }];
  }
  if (!Array.isArray(paths)) {
    return [];
  }
  return paths.filter((path): path is string => typeof path === "string").map((path) => ({ path }));
}

function assetRefFromInstance(instance: unknown): AssetRef[] {
  if (!instance || typeof instance !== "object") {
    return [];
  }
  const path = (instance as { path?: unknown }).path;
  if (typeof path !== "string") {
    return [];
  }
  const dicom = dicomFromUnknown((instance as { dicom?: unknown }).dicom);
  return [{ path, ...(dicom ? { dicom } : {}) }];
}

function dicomFromUnknown(value: unknown): ClinicalViewportAsset["dicom"] | undefined {
  return value && typeof value === "object" ? value as ClinicalViewportAsset["dicom"] : undefined;
}
