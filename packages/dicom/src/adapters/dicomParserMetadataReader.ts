import { parseDicom, type DataSet } from "dicom-parser";
import { hasSeriesIdentity, type DicomMetadata, type DicomMetadataReader } from "../metadata";
import { parseFastDicomMetadata } from "./fastDicomMetadata";
import { rtstructMetadataFromDataSet } from "./rtstructMetadata";

const DICOM_TAG = {
  TRANSFER_SYNTAX_UID: "x00020010",
  SOP_INSTANCE_UID: "x00080018",
  MODALITY: "x00080060",
  SERIES_DESCRIPTION: "x0008103e",
  STUDY_INSTANCE_UID: "x0020000d",
  SERIES_INSTANCE_UID: "x0020000e",
  INSTANCE_NUMBER: "x00200013",
  IMAGE_POSITION_PATIENT: "x00200032",
  IMAGE_ORIENTATION_PATIENT: "x00200037",
  FRAME_OF_REFERENCE_UID: "x00200052",
  PIXEL_SPACING: "x00280030",
  PIXEL_DATA: "x7fe00010",
} as const;

type DicomParserTag = (typeof DICOM_TAG)[keyof typeof DICOM_TAG];

export interface DicomParserMetadataReaderOptions {
  initialBlobBytes?: number;
  maxBlobBytes?: number;
}

const DEFAULT_INITIAL_BLOB_BYTES = 256 * 1024;
const DEFAULT_MAX_BLOB_BYTES = 4 * 1024 * 1024;
const FAST_METADATA_READ_BYTES = 128 * 1024;

export class DicomParserMetadataReader implements DicomMetadataReader {
  readonly id = "dicom-parser";

  constructor(private readonly options: DicomParserMetadataReaderOptions = {}) {}

  async readMetadata(input: ArrayBuffer | Blob): Promise<DicomMetadata | undefined> {
    try {
      const fastBytes = isBlob(input)
        ? new Uint8Array(await blobHeader(input, Math.min(input.size, this.options.initialBlobBytes ?? FAST_METADATA_READ_BYTES)))
        : new Uint8Array(input);
      const fastMetadata = parseFastDicomMetadata(fastBytes);
      const isRtstruct = fastMetadata?.modality?.toUpperCase() === "RTSTRUCT";
      if (hasSeriesIdentity(fastMetadata) && !isRtstruct) {
        return fastMetadata;
      }

      const dataSet = isBlob(input)
        ? await parseBlobHeader(input, this.options, isRtstruct)
        : parseDicom(new Uint8Array(input), { untilTag: DICOM_TAG.PIXEL_DATA });
      const metadata = metadataFromDataSet(dataSet);
      return Object.keys(metadata).length > 0 ? metadata : undefined;
    } catch {
      return undefined;
    }
  }
}

function isBlob(input: ArrayBuffer | Blob): input is Blob {
  return typeof Blob !== "undefined" && input instanceof Blob;
}

async function parseBlobHeader(input: Blob, options: DicomParserMetadataReaderOptions, requireFullMetadata = false): Promise<DataSet> {
  const maxBytes = Math.max(1, Math.min(options.maxBlobBytes ?? DEFAULT_MAX_BLOB_BYTES, input.size));
  const initialBytes = Math.max(1, Math.min(options.initialBlobBytes ?? DEFAULT_INITIAL_BLOB_BYTES, maxBytes));
  let bytesToRead = initialBytes;

  while (true) {
    try {
      const dataSet = parseDicom(new Uint8Array(await blobHeader(input, bytesToRead)), {
        untilTag: DICOM_TAG.PIXEL_DATA,
      });
      if (hasEnoughBlobHeaderMetadata(dataSet, { requireFullMetadata, bytesToRead, maxBytes })) {
        return dataSet;
      }
    } catch (error) {
      if (bytesToRead >= maxBytes) {
        throw error;
      }
    }

    bytesToRead = Math.min(bytesToRead * 2, maxBytes);
  }
}

function hasEnoughBlobHeaderMetadata(
  dataSet: DataSet,
  { requireFullMetadata, bytesToRead, maxBytes }: { requireFullMetadata: boolean; bytesToRead: number; maxBytes: number },
): boolean {
  return (!requireFullMetadata && hasSeriesIdentity(metadataFromDataSet(dataSet))) || hasPixelDataElement(dataSet) || bytesToRead >= maxBytes;
}

function blobHeader(input: Blob, bytesToRead: number): Promise<ArrayBuffer> {
  return input.slice(0, bytesToRead).arrayBuffer();
}

function hasPixelDataElement(dataSet: DataSet): boolean {
  return Boolean(dataSet.elements[DICOM_TAG.PIXEL_DATA]);
}

function metadataFromDataSet(dataSet: DataSet): DicomMetadata {
  return cleanUndefined({
    sopInstanceUid: stringTag(dataSet, DICOM_TAG.SOP_INSTANCE_UID),
    seriesInstanceUid: stringTag(dataSet, DICOM_TAG.SERIES_INSTANCE_UID),
    studyInstanceUid: stringTag(dataSet, DICOM_TAG.STUDY_INSTANCE_UID),
    modality: stringTag(dataSet, DICOM_TAG.MODALITY),
    seriesDescription: stringTag(dataSet, DICOM_TAG.SERIES_DESCRIPTION),
    frameOfReferenceUid: stringTag(dataSet, DICOM_TAG.FRAME_OF_REFERENCE_UID),
    instanceNumber: dataSet.intString(DICOM_TAG.INSTANCE_NUMBER),
    imagePositionPatient: numberListTag(dataSet, DICOM_TAG.IMAGE_POSITION_PATIENT),
    imageOrientationPatient: numberListTag(dataSet, DICOM_TAG.IMAGE_ORIENTATION_PATIENT),
    pixelSpacing: numberListTag(dataSet, DICOM_TAG.PIXEL_SPACING),
    transferSyntaxUid: stringTag(dataSet, DICOM_TAG.TRANSFER_SYNTAX_UID),
    rtstruct: rtstructMetadataFromDataSet(dataSet),
  }) as DicomMetadata;
}

function stringTag(dataSet: DataSet, tag: DicomParserTag): string | undefined {
  const value = dataSet.string(tag)?.trim();
  return value ? value : undefined;
}

function numberListTag(dataSet: DataSet, tag: DicomParserTag): readonly number[] | undefined {
  const count = dataSet.numStringValues(tag) ?? 0;
  const values = Array.from({ length: count }, (_unused, index) => dataSet.floatString(tag, index)).filter(
    (value): value is number => typeof value === "number",
  );
  return values.length > 0 ? values : undefined;
}

function cleanUndefined<T extends Record<string, unknown>>(metadata: T): T {
  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as T;
}
