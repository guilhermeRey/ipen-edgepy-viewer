import type { ClinicalViewportAsset } from "@pycom-next/react-viewer";

const INITIAL_IMAGE_LOAD_TIMEOUT_MS = 7000;

export interface CornerstoneImageLoaderLike {
  loadAndCacheImage(imageId: string): Promise<unknown>;
}

export interface InitialImageSelectionOptions {
  imageLoader: CornerstoneImageLoaderLike;
  imageIds: readonly string[];
  assets: readonly ClinicalViewportAsset[];
  preferredIndex: number;
  onStatus(message: string): void;
}

export async function selectLoadableInitialImageIndex(options: InitialImageSelectionOptions): Promise<number> {
  let lastError: unknown;
  for (const index of candidateInitialImageIndexes(options.preferredIndex, options.imageIds.length)) {
    const asset = options.assets[index];
    options.onStatus(`Loading initial DICOM image ${index + 1}/${options.imageIds.length}: ${asset?.path ?? options.imageIds[index]}`);
    try {
      await withTimeout(
        options.imageLoader.loadAndCacheImage(options.imageIds[index]),
        INITIAL_IMAGE_LOAD_TIMEOUT_MS,
        `Initial DICOM image load timed out after ${INITIAL_IMAGE_LOAD_TIMEOUT_MS}ms: ${asset?.path ?? options.imageIds[index]}`,
      );
      return index;
    } catch (error) {
      lastError = error;
      console.warn("Cornerstone initial DICOM image load failed", {
        path: asset?.path,
        imageId: options.imageIds[index],
        error,
      });
    }
  }

  throw new Error(`Unable to load initial DICOM image. ${errorMessage(lastError)}`);
}

function candidateInitialImageIndexes(preferredIndex: number, imageCount: number): number[] {
  const lastIndex = imageCount - 1;
  return uniqueIndexes([preferredIndex, 0, lastIndex]).filter((index) => index >= 0 && index <= lastIndex);
}

function uniqueIndexes(indexes: readonly number[]): number[] {
  return Array.from(new Set(indexes));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown image load failure.";
}
