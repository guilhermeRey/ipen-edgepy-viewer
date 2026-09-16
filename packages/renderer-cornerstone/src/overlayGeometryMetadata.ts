import { DicomParserMetadataReader, type DicomMetadata, type DicomMetadataReader } from "@pycom-next/dicom";
import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";

export interface OverlayGeometryMetadataCache {
  metadataForAsset(asset: ClinicalViewportAsset): Promise<ClinicalViewportAsset["dicom"] | undefined>;
  metadataForAssets(assets: readonly ClinicalViewportAsset[]): Promise<Array<ClinicalViewportAsset["dicom"] | undefined>>;
}

export function createOverlayGeometryMetadataCache(
  reader: DicomMetadataReader = new DicomParserMetadataReader(),
): OverlayGeometryMetadataCache {
  const metadataByPath = new Map<string, Promise<DicomMetadata | undefined>>();
  return {
    async metadataForAsset(asset) {
      if (asset.dicom) {
        return asset.dicom;
      }
      let metadata = metadataByPath.get(asset.path);
      if (!metadata) {
        metadata = reader.readMetadata(asset.data).catch(() => undefined);
        metadataByPath.set(asset.path, metadata);
      }
      return metadata;
    },
    async metadataForAssets(assets) {
      return Promise.all(assets.map((asset) => this.metadataForAsset(asset)));
    },
  };
}
