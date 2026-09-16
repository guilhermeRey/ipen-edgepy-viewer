import type { DicomMetadata } from "../metadata";

const DICOM_LONG_VALUE_VRS = new Set(["OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UR", "UT", "UN"]);
const DICOM_TEXT_DECODER = new TextDecoder("ascii");

interface ParsedDicomElement {
  tag: string;
  valueOffset: number;
  valueLength: number;
  nextOffset: number;
}

interface FastDicomReadState {
  offset: number;
  littleEndian: boolean;
  explicitVr: boolean;
  metadata: DicomMetadata;
}

interface MetadataElementSource {
  bytes: Uint8Array;
  element: ParsedDicomElement;
}

interface DicomElementParts {
  group: number;
  element: number;
  valueOffset: number;
  valueLength: number;
}

export function parseFastDicomMetadata(bytes: Uint8Array): DicomMetadata | undefined {
  const state = initialReadState(bytes);
  readMetadataElements(bytes, state);
  return Object.keys(state.metadata).length > 0 ? state.metadata : undefined;
}

function initialReadState(bytes: Uint8Array): FastDicomReadState {
  const transferSyntax = readTransferSyntax(bytes);
  const offset = transferSyntax.offset;
  const transferSyntaxUid = transferSyntax.uid;
  const littleEndian = transferSyntaxUid !== "1.2.840.10008.1.2.2";
  const explicitVr = transferSyntaxUid ? transferSyntaxUid !== "1.2.840.10008.1.2" : hasExplicitVrAt(bytes, offset);
  return {
    offset,
    littleEndian,
    explicitVr,
    metadata: {
      ...(transferSyntaxUid ? { transferSyntaxUid } : {}),
    },
  };
}

function readTransferSyntax(bytes: Uint8Array): { offset: number; uid?: string } {
  let offset = hasDicomPreamble(bytes) ? 132 : 0;
  let uid: string | undefined;

  if (!hasDicomPreamble(bytes)) {
    return { offset };
  }

  while (offset + 8 <= bytes.length) {
    const group = readUint16(bytes, offset, true);
    if (group !== 0x0002) {
      break;
    }
    const element = readExplicitDicomElement(bytes, offset, true);
    if (!element) {
      break;
    }
    if (element.tag === "00020010") {
      uid = dicomString(bytes, element);
    }
    offset = element.nextOffset;
  }

  return { offset, ...(uid ? { uid } : {}) };
}

function readMetadataElements(bytes: Uint8Array, state: FastDicomReadState): void {
  while (state.offset + 8 <= bytes.length) {
    const element = readNextElement(bytes, state);
    if (!element || element.valueLength === 0xffffffff || element.tag === "7FE00010") {
      break;
    }
    applyFastDicomMetadataElement(state.metadata, bytes, element);
    state.offset = element.nextOffset;
  }
}

function readNextElement(bytes: Uint8Array, state: FastDicomReadState): ParsedDicomElement | undefined {
  return state.explicitVr
    ? readExplicitDicomElement(bytes, state.offset, state.littleEndian)
    : readImplicitDicomElement(bytes, state.offset, state.littleEndian);
}

function applyFastDicomMetadataElement(metadata: DicomMetadata, bytes: Uint8Array, element: ParsedDicomElement): void {
  const stringKeyByTag: Record<string, keyof DicomMetadata> = {
    "00080018": "sopInstanceUid",
    "00080060": "modality",
    "0008103E": "seriesDescription",
    "0020000D": "studyInstanceUid",
    "0020000E": "seriesInstanceUid",
    "00200052": "frameOfReferenceUid",
  };
  const numberListKeyByTag: Record<string, keyof DicomMetadata> = {
    "00200032": "imagePositionPatient",
    "00200037": "imageOrientationPatient",
    "00280030": "pixelSpacing",
  };

  const stringKey = stringKeyByTag[element.tag];
  if (stringKey) {
    setDicomString(metadata, stringKey, { bytes, element });
    return;
  }

  const numberListKey = numberListKeyByTag[element.tag];
  if (numberListKey) {
    setDicomNumbers(metadata, numberListKey, { bytes, element });
    return;
  }

  if (element.tag === "00200013") {
    setDicomNumber(metadata, "instanceNumber", { bytes, element });
  }
}

function setDicomString(metadata: DicomMetadata, key: keyof DicomMetadata, source: MetadataElementSource): void {
  const value = dicomString(source.bytes, source.element);
  if (value) {
    metadata[key] = value as never;
  }
}

function setDicomNumbers(metadata: DicomMetadata, key: keyof DicomMetadata, source: MetadataElementSource): void {
  const value = dicomNumbers(source.bytes, source.element);
  if (value) {
    metadata[key] = value as never;
  }
}

function setDicomNumber(metadata: DicomMetadata, key: keyof DicomMetadata, source: MetadataElementSource): void {
  const value = dicomNumber(source.bytes, source.element);
  if (value !== undefined) {
    metadata[key] = value as never;
  }
}

function readExplicitDicomElement(bytes: Uint8Array, offset: number, littleEndian: boolean): ParsedDicomElement | undefined {
  if (offset + 8 > bytes.length) {
    return undefined;
  }

  const group = readUint16(bytes, offset, littleEndian);
  const element = readUint16(bytes, offset + 2, littleEndian);
  const vr = asciiAt(bytes, offset + 4, 2);
  if (!/^[A-Z]{2}$/.test(vr)) {
    return undefined;
  }

  const usesLongValueLength = DICOM_LONG_VALUE_VRS.has(vr);
  if (usesLongValueLength && offset + 12 > bytes.length) {
    return undefined;
  }
  const valueOffset = offset + (usesLongValueLength ? 12 : 8);
  const valueLength = usesLongValueLength
    ? readUint32(bytes, offset + 8, littleEndian)
    : readUint16(bytes, offset + 6, littleEndian);
  return dicomElement({ group, element, valueOffset, valueLength });
}

function readImplicitDicomElement(bytes: Uint8Array, offset: number, littleEndian: boolean): ParsedDicomElement | undefined {
  if (offset + 8 > bytes.length) {
    return undefined;
  }

  const group = readUint16(bytes, offset, littleEndian);
  const element = readUint16(bytes, offset + 2, littleEndian);
  const valueOffset = offset + 8;
  const valueLength = readUint32(bytes, offset + 4, littleEndian);
  return dicomElement({ group, element, valueOffset, valueLength });
}

function dicomElement({ group, element, valueOffset, valueLength }: DicomElementParts): ParsedDicomElement | undefined {
  const nextOffset = valueOffset + valueLength;
  if (valueLength !== 0xffffffff && nextOffset < valueOffset) {
    return undefined;
  }
  return {
    tag: `${hex4(group)}${hex4(element)}`,
    valueOffset,
    valueLength,
    nextOffset,
  };
}

function hasDicomPreamble(bytes: Uint8Array): boolean {
  return bytes.length >= 132 && asciiAt(bytes, 128, 4) === "DICM";
}

function hasExplicitVrAt(bytes: Uint8Array, offset: number): boolean {
  return offset + 6 <= bytes.length && /^[A-Z]{2}$/.test(asciiAt(bytes, offset + 4, 2));
}

function dicomString(bytes: Uint8Array, element: ParsedDicomElement): string | undefined {
  if (!dicomValueFits(bytes, element)) {
    return undefined;
  }
  const value = DICOM_TEXT_DECODER.decode(bytes.subarray(element.valueOffset, element.valueOffset + element.valueLength));
  return value.replace(/\0/g, "").trim() || undefined;
}

function dicomNumbers(bytes: Uint8Array, element: ParsedDicomElement): number[] | undefined {
  const value = dicomString(bytes, element);
  if (!value) {
    return undefined;
  }
  const numbers = value.split("\\").map((part) => Number(part.trim())).filter((part) => Number.isFinite(part));
  return numbers.length > 0 ? numbers : undefined;
}

function dicomNumber(bytes: Uint8Array, element: ParsedDicomElement): number | undefined {
  return dicomNumbers(bytes, element)?.[0];
}

function dicomValueFits(bytes: Uint8Array, element: ParsedDicomElement): boolean {
  return element.valueLength !== 0xffffffff && element.valueOffset + element.valueLength <= bytes.length;
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 2);
  return view.getUint16(0, littleEndian);
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  return view.getUint32(0, littleEndian);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) {
    return "";
  }
  return DICOM_TEXT_DECODER.decode(bytes.subarray(offset, offset + length));
}

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}
