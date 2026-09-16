import { expose } from "comlink";

const IMPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2";
const EXPLICIT_LITTLE_ENDIAN = "1.2.840.10008.1.2.1";
const EXPLICIT_BIG_ENDIAN = "1.2.840.10008.1.2.2";

interface DecodeTaskArgs {
  imageFrame: DecodeImageFrame;
  transferSyntax: string;
  pixelData: Uint8Array;
  options?: DecodeOptions;
}

interface DecodeOptions {
  allowFloatRendering?: boolean;
  preScale?: {
    enabled?: boolean;
    scalingParameters?: ScalingParameters;
  };
}

interface ScalingParameters {
  rescaleSlope?: number;
  rescaleIntercept?: number;
  modality?: string;
  doseGridScaling?: number;
  suvbw?: number;
}

interface DecodeImageFrame {
  bitsAllocated: number;
  bitsStored?: number;
  pixelRepresentation?: number;
  pixelData: NumericPixelData;
  pixelDataLength?: number;
  smallestPixelValue?: number;
  largestPixelValue?: number;
  decodeTimeInMS?: number;
  preScale?: DecodeOptions["preScale"] & { scaled?: boolean };
}

type NumericPixelData = Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array | Float32Array;

const workerApi = {
  async decodeTask({ imageFrame, transferSyntax, pixelData, options = {} }: DecodeTaskArgs): Promise<DecodeImageFrame> {
    const start = Date.now();
    const decodedFrame = decodeUncompressed(imageFrame, transferSyntax, pixelData);
    return postProcessDecodedPixels(decodedFrame, options, start);
  },
};

function decodeUncompressed(
  imageFrame: DecodeImageFrame,
  transferSyntax: string,
  pixelData: Uint8Array,
): DecodeImageFrame {
  if (transferSyntax === IMPLICIT_LITTLE_ENDIAN || transferSyntax === EXPLICIT_LITTLE_ENDIAN) {
    imageFrame.pixelData = decodeLittleEndianPixels(imageFrame, pixelData);
    return imageFrame;
  }
  if (transferSyntax === EXPLICIT_BIG_ENDIAN) {
    imageFrame.pixelData = decodeBigEndianPixels(imageFrame, pixelData);
    return imageFrame;
  }
  throw new Error(`Unsupported lightweight decode transfer syntax ${transferSyntax}`);
}

function decodeLittleEndianPixels(imageFrame: DecodeImageFrame, pixelData: Uint8Array): NumericPixelData {
  if (imageFrame.bitsAllocated === 16) {
    const { buffer, offset } = alignedBuffer(pixelData, 2);
    return imageFrame.pixelRepresentation === 0
      ? new Uint16Array(buffer, offset, pixelData.length / 2)
      : new Int16Array(buffer, offset, pixelData.length / 2);
  }
  if (imageFrame.bitsAllocated === 8 || imageFrame.bitsAllocated === 1) {
    return pixelData;
  }
  if (imageFrame.bitsAllocated === 32) {
    const { buffer, offset } = alignedBuffer(pixelData, 4);
    return imageFrame.pixelRepresentation === 0
      ? new Uint32Array(buffer, offset, pixelData.length / 4)
      : new Int32Array(buffer, offset, pixelData.length / 4);
  }
  throw new Error(`Unsupported lightweight decode bit depth ${imageFrame.bitsAllocated}`);
}

function decodeBigEndianPixels(imageFrame: DecodeImageFrame, pixelData: Uint8Array): NumericPixelData {
  if (imageFrame.bitsAllocated === 8) {
    return pixelData;
  }
  if (imageFrame.bitsAllocated !== 16) {
    throw new Error(`Unsupported lightweight big endian bit depth ${imageFrame.bitsAllocated}`);
  }

  const output = imageFrame.pixelRepresentation === 0
    ? new Uint16Array(pixelData.length / 2)
    : new Int16Array(pixelData.length / 2);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = (pixelData[index * 2] << 8) | pixelData[index * 2 + 1];
  }
  return output;
}

function postProcessDecodedPixels(
  imageFrame: DecodeImageFrame,
  options: DecodeOptions,
  start: number,
): DecodeImageFrame {
  shiftSignedPixels(imageFrame);
  imageFrame.pixelDataLength = imageFrame.pixelData.length;

  const minMaxBeforeScale = getMinMax(imageFrame.pixelData);
  const shouldScale = shouldPreScale(options);
  const minMaxAfterScale = shouldScale ? scaledMinMax(minMaxBeforeScale, options.preScale?.scalingParameters) : minMaxBeforeScale;
  const output = createPixelArray(minMaxAfterScale.min, minMaxAfterScale.max, imageFrame.pixelData.length);
  output.set(imageFrame.pixelData);

  if (shouldScale) {
    scaleArray(output, options.preScale?.scalingParameters);
    imageFrame.preScale = { ...options.preScale, scaled: true };
  }

  imageFrame.pixelData = output;
  imageFrame.smallestPixelValue = minMaxAfterScale.min;
  imageFrame.largestPixelValue = minMaxAfterScale.max;
  imageFrame.decodeTimeInMS = Date.now() - start;
  return imageFrame;
}

function alignedBuffer(pixelData: Uint8Array, alignment: number): { buffer: ArrayBufferLike; offset: number } {
  if (pixelData.byteOffset % alignment === 0) {
    return { buffer: pixelData.buffer, offset: pixelData.byteOffset };
  }
  return { buffer: pixelData.buffer.slice(pixelData.byteOffset), offset: 0 };
}

function shiftSignedPixels(imageFrame: DecodeImageFrame): void {
  if (imageFrame.pixelRepresentation !== 1 || imageFrame.bitsStored === undefined) {
    return;
  }
  const shift = 32 - imageFrame.bitsStored;
  for (let index = 0; index < imageFrame.pixelData.length; index += 1) {
    imageFrame.pixelData[index] = (imageFrame.pixelData[index] << shift) >> shift;
  }
}

function shouldPreScale(options: DecodeOptions): boolean {
  const scaling = options.preScale?.scalingParameters;
  if (options.preScale?.enabled === false || !scaling) {
    return false;
  }
  return hasNumber(scaling.rescaleSlope) && hasNumber(scaling.rescaleIntercept);
}

function scaledMinMax(
  minMax: { min: number; max: number },
  scaling: ScalingParameters | undefined,
): { min: number; max: number } {
  if (!scaling) {
    return minMax;
  }
  const min = scaledValue(minMax.min, scaling);
  const max = scaledValue(minMax.max, scaling);
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function scaledValue(value: number, scaling: ScalingParameters): number {
  if (scaling.modality === "PT" && hasNumber(scaling.suvbw)) {
    return scaling.suvbw * (value * (scaling.rescaleSlope ?? 1) + (scaling.rescaleIntercept ?? 0));
  }
  if (scaling.modality === "RTDOSE" && hasNumber(scaling.doseGridScaling)) {
    return value * scaling.doseGridScaling;
  }
  return value * (scaling.rescaleSlope ?? 1) + (scaling.rescaleIntercept ?? 0);
}

function scaleArray(pixelData: NumericPixelData, scaling: ScalingParameters | undefined): void {
  if (!scaling) {
    return;
  }
  for (let index = 0; index < pixelData.length; index += 1) {
    pixelData[index] = scaledValue(pixelData[index], scaling);
  }
}

function createPixelArray(min: number, max: number, length: number): NumericPixelData {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return new Float32Array(length);
  }
  const candidate = PIXEL_ARRAY_CANDIDATES.find((item) => min >= item.min && max <= item.max);
  return candidate ? candidate.create(length) : new Float32Array(length);
}

const PIXEL_ARRAY_CANDIDATES = [
  { min: 0, max: 255, create: (length: number) => new Uint8Array(length) },
  { min: 0, max: 65535, create: (length: number) => new Uint16Array(length) },
  { min: -32768, max: 32767, create: (length: number) => new Int16Array(length) },
  { min: 0, max: 4294967295, create: (length: number) => new Uint32Array(length) },
] as const;

function getMinMax(pixelData: NumericPixelData): { min: number; max: number } {
  let min = pixelData[0];
  let max = pixelData[0];
  for (let index = 1; index < pixelData.length; index += 1) {
    min = Math.min(min, pixelData[index]);
    max = Math.max(max, pixelData[index]);
  }
  return { min, max };
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

expose(workerApi);
