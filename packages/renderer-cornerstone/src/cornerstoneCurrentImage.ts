import type { ClinicalViewportAsset, ClinicalViewportImageData, ClinicalViewportRendererHandle } from "@pycom-next/react-viewer";
import type { RuntimeImageLike, WorldMappableViewportLike } from "./fusionOverlayTypes";

export interface CurrentImageDataOptions {
  assets: readonly ClinicalViewportAsset[];
  imageIds: readonly string[];
  viewport: WorldMappableViewportLike;
  loadImage(imageId: string): Promise<RuntimeImageLike>;
}

export async function cornerstoneCurrentImageData(options: CurrentImageDataOptions): Promise<ClinicalViewportImageData | undefined> {
  const sliceIndex = options.viewport.getCurrentImageIdIndex();
  const imageId = options.imageIds[sliceIndex];
  if (!imageId) {
    return undefined;
  }
  const image = await options.loadImage(imageId);
  const size = imageSize(image);
  if (!size) {
    return undefined;
  }
  return {
    ...size,
    sliceIndex,
    values: Float32Array.from(image.getPixelData()),
    imageId,
    ...seriesUidProperty(options.assets[sliceIndex]),
  };
}

export function sameImageShape(
  overlay: Parameters<NonNullable<ClinicalViewportRendererHandle["setTemporaryOverlay"]>>[0],
  image: Awaited<ReturnType<NonNullable<ClinicalViewportRendererHandle["getCurrentImageData"]>>>,
): boolean {
  return Boolean(overlay && image && overlay.sliceIndex === image.sliceIndex && overlay.width === image.width && overlay.height === image.height);
}

function imageSize(image: RuntimeImageLike): { width: number; height: number } | undefined {
  const width = image.columns ?? image.width;
  const height = image.rows ?? image.height;
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function seriesUidProperty(asset: ClinicalViewportAsset | undefined): { seriesUid?: string } {
  const seriesUid = asset?.dicom?.seriesInstanceUid;
  return seriesUid ? { seriesUid } : {};
}
