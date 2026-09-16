import type { ClinicalViewportAsset, ClinicalViewportOverlayAssets } from "@pycom-next/react-viewer";
import type { FusionOverlayLayer, RuntimeImageLike } from "./fusionOverlayTypes";

type DicomMetadata = ClinicalViewportAsset["dicom"];

interface MhdHeader {
  dataFile: string;
  dimSize: [number, number, number];
  elementType: string;
  offset: [number, number, number];
  spacing: [number, number, number];
}

interface MhdDoseVolume {
  metadata: DicomMetadata[];
  slice(index: number, frameOfReferenceUid: string | undefined): { asset: ClinicalViewportAsset; image: RuntimeImageLike };
}

export interface MhdDoseVolumeData {
  mhdPath: string;
  rawPath: string;
  dataFile: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  offset: [number, number, number];
  elementType: string;
  values: Float32Array;
}

const MAX_PERCENTILE_SAMPLES = 100_000;
const DOSE_DISPLAY_MIN_PERCENTILE = 0.75;
const DOSE_DISPLAY_MAX_PERCENTILE = 0.99;

export interface MhdDoseVolumeCache {
  volumeForAssets(assets: readonly ClinicalViewportAsset[]): Promise<MhdDoseVolume | undefined>;
}

export function createMhdDoseVolumeCache(): MhdDoseVolumeCache {
  const volumeByKey = new Map<string, Promise<MhdDoseVolume | undefined>>();
  return {
    volumeForAssets(assets) {
      const key = assets.map((asset) => asset.path).sort((left, right) => left.localeCompare(right)).join("|");
      let volume = volumeByKey.get(key);
      if (!volume) {
        volume = loadMhdDoseVolume(assets);
        volumeByKey.set(key, volume);
      }
      return volume;
    },
  };
}

export function isMhdDoseAssetGroup(assets: readonly ClinicalViewportAsset[]): boolean {
  return assets.some((asset) => isMhdPath(asset.path));
}

export function isMhdDoseLayer(layer: FusionOverlayLayer): boolean {
  return layer.purpose === "dose" && isMhdDoseAssetGroup(layer.assets);
}

export function mhdDoseOverlayLayers(overlays: readonly ClinicalViewportOverlayAssets[]): FusionOverlayLayer[] {
  return overlays.flatMap((overlay, index) => {
    if (overlay.overlay.kind !== "dose" || !isMhdDoseAssetGroup(overlay.assets)) {
      return [];
    }
    return [{
      label: overlay.overlay.label,
      purpose: "dose",
      assets: overlay.assets,
      imageIds: [],
      color: doseColor(index),
      opacity: typeof overlay.overlay.metadata?.opacity === "number" ? overlay.overlay.metadata.opacity : 0.65,
    }];
  });
}

export async function loadMhdDoseVolumeData(assets: readonly ClinicalViewportAsset[]): Promise<MhdDoseVolumeData | undefined> {
  const mhdAsset = assets.find((asset) => isMhdPath(asset.path));
  if (!mhdAsset) {
    return undefined;
  }
  const header = parseMhdHeader(await assetText(mhdAsset));
  if (header.elementType !== "MET_FLOAT") {
    throw new Error(`Unsupported MHD dose element type: ${header.elementType}`);
  }
  const rawAsset = findRawAsset(assets, mhdAsset, header);
  if (!rawAsset) {
    throw new Error(`MHD dose raw file not found: ${header.dataFile}`);
  }
  const values = new Float32Array(await assetArrayBuffer(rawAsset));
  const valueCount = header.dimSize[0] * header.dimSize[1] * header.dimSize[2];
  if (values.length < valueCount) {
    throw new Error(`MHD dose raw file is smaller than expected for ${mhdAsset.path}.`);
  }
  return {
    mhdPath: mhdAsset.path,
    rawPath: rawAsset.path,
    dataFile: header.dataFile,
    dimensions: header.dimSize,
    spacing: header.spacing,
    offset: header.offset,
    elementType: header.elementType,
    values: values.length === valueCount ? values : values.slice(0, valueCount),
  };
}

async function loadMhdDoseVolume(assets: readonly ClinicalViewportAsset[]): Promise<MhdDoseVolume | undefined> {
  const data = await loadMhdDoseVolumeData(assets);
  const mhdAsset = data ? assets.find((asset) => asset.path === data.mhdPath) : undefined;
  return data && mhdAsset ? createVolume(mhdAsset, data) : undefined;
}

function createVolume(mhdAsset: ClinicalViewportAsset, data: MhdDoseVolumeData): MhdDoseVolume {
  const [width, height, sliceCount] = data.dimensions;
  const sliceSize = width * height;
  const [minPixelValue, maxPixelValue] = doseDisplayRange(data.values);
  const metadata = Array.from({ length: sliceCount }, (_, index) => metadataForSlice(data, index));
  return {
    metadata,
    slice(index, frameOfReferenceUid) {
      const sliceIndex = clamp(index, 0, sliceCount - 1);
      const pixels = data.values.subarray(sliceIndex * sliceSize, (sliceIndex + 1) * sliceSize);
      const dicom = withFrameOfReference(metadata[sliceIndex], frameOfReferenceUid);
      return {
        asset: { path: `${mhdAsset.path}#slice-${sliceIndex}`, data: mhdAsset.data, ...(dicom ? { dicom } : {}) },
        image: { width, height, rows: height, columns: width, minPixelValue, maxPixelValue, getPixelData: () => pixels },
      };
    },
  };
}

function parseMhdHeader(text: string): MhdHeader {
  const fields = new Map(text.split(/\r?\n/).flatMap(headerLine));
  return {
    dataFile: requiredField(fields, "ElementDataFile"),
    dimSize: numberTuple(requiredField(fields, "DimSize"), 3),
    elementType: requiredField(fields, "ElementType"),
    offset: numberTuple(fields.get("Offset") ?? "0 0 0", 3),
    spacing: numberTuple(requiredField(fields, "ElementSpacing"), 3),
  };
}

function headerLine(line: string): Array<[string, string]> {
  const match = /^([^=]+)=(.+)$/.exec(line.trim());
  return match ? [[match[1].trim(), match[2].trim()]] : [];
}

function requiredField(fields: ReadonlyMap<string, string>, name: string): string {
  const value = fields.get(name);
  if (!value) {
    throw new Error(`MHD dose header missing ${name}.`);
  }
  return value;
}

function numberTuple(value: string, count: number): [number, number, number] {
  const numbers = value.split(/\s+/).map(Number);
  if (numbers.length < count || numbers.slice(0, count).some((number) => !Number.isFinite(number))) {
    throw new Error(`Invalid MHD numeric tuple: ${value}`);
  }
  return [numbers[0], numbers[1], numbers[2]];
}

function metadataForSlice(header: Pick<MhdDoseVolumeData, "offset" | "spacing">, sliceIndex: number): DicomMetadata {
  return {
    modality: "RTDOSE",
    imageOrientationPatient: [1, 0, 0, 0, 1, 0],
    imagePositionPatient: [header.offset[0], header.offset[1], header.offset[2] + header.spacing[2] * sliceIndex],
    pixelSpacing: [header.spacing[1], header.spacing[0]],
  };
}

function findRawAsset(assets: readonly ClinicalViewportAsset[], mhdAsset: ClinicalViewportAsset, header: MhdHeader): ClinicalViewportAsset | undefined {
  const directory = parentDirectory(mhdAsset.path);
  return assets.find((asset) => parentDirectory(asset.path) === directory && fileName(asset.path).toLowerCase() === header.dataFile.toLowerCase())
    ?? assets.find((asset) => parentDirectory(asset.path) === directory && fileStem(asset.path) === fileStem(header.dataFile) && isRawPath(asset.path));
}

function withFrameOfReference(metadata: DicomMetadata, frameOfReferenceUid: string | undefined): DicomMetadata {
  return frameOfReferenceUid ? { ...metadata, frameOfReferenceUid } : metadata;
}

async function assetText(asset: ClinicalViewportAsset): Promise<string> {
  return asset.data instanceof Blob ? asset.data.text() : new TextDecoder().decode(asset.data);
}

async function assetArrayBuffer(asset: ClinicalViewportAsset): Promise<ArrayBuffer> {
  return asset.data instanceof Blob ? asset.data.arrayBuffer() : asset.data;
}

function doseDisplayRange(values: Float32Array): [number, number] {
  const max = maxFiniteValue(values);
  const robustMin = positivePercentile(values, DOSE_DISPLAY_MIN_PERCENTILE) ?? 0;
  const robustMax = positivePercentile(values, DOSE_DISPLAY_MAX_PERCENTILE);
  const displayMax = robustMax && robustMax > 0 ? robustMax : max;
  return [robustMin < displayMax ? robustMin : 0, displayMax > 0 ? displayMax : 1];
}

function maxFiniteValue(values: Float32Array): number {
  let max = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return Number.isFinite(max) ? max : 1;
}

function positivePercentile(values: Float32Array, percentile: number): number | undefined {
  const positiveCount = countPositiveFinite(values);
  if (positiveCount === 0) {
    return undefined;
  }
  const stride = Math.max(1, Math.ceil(positiveCount / MAX_PERCENTILE_SAMPLES));
  const sample: number[] = [];
  let seen = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value > 0) {
      seen += 1;
      if (seen % stride === 0) {
        sample.push(value);
      }
    }
  }
  sample.sort((left, right) => left - right);
  return sample[Math.min(sample.length - 1, Math.max(0, Math.round((sample.length - 1) * percentile)))];
}

function countPositiveFinite(values: Float32Array): number {
  let count = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value) && value > 0) {
      count += 1;
    }
  }
  return count;
}

function parentDirectory(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts.slice(0, -1).join("/").toLowerCase();
}

function fileName(path: string): string {
  return path.split(/[\\/]+/).filter(Boolean).at(-1) ?? path;
}

function fileStem(path: string): string {
  return fileName(path).replace(/\.[^.]+$/, "").toLowerCase();
}

function isMhdPath(path: string): boolean {
  return path.toLowerCase().endsWith(".mhd");
}

function isRawPath(path: string): boolean {
  return path.toLowerCase().endsWith(".raw");
}

function doseColor(index: number): string {
  return ["#f97316", "#ef4444", "#facc15", "#a855f7"][index % 4] ?? "#f97316";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
