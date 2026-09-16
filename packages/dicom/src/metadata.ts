export interface DicomMetadata {
  sopInstanceUid?: string;
  seriesInstanceUid?: string;
  studyInstanceUid?: string;
  modality?: string;
  seriesDescription?: string;
  frameOfReferenceUid?: string;
  instanceNumber?: number;
  imagePositionPatient?: readonly number[];
  imageOrientationPatient?: readonly number[];
  pixelSpacing?: readonly number[];
  transferSyntaxUid?: string;
  rtstruct?: RtstructMetadata;
}

export interface RtstructMetadata {
  structureCount: number;
  contourCount: number;
  pointCount: number;
  structureSetLabel?: string;
  structureSetName?: string;
  structures: readonly RtstructStructureMetadata[];
}

export interface RtstructStructureMetadata {
  roiNumber?: number;
  name?: string;
  contourCount: number;
  pointCount: number;
  referencedSopInstanceUids?: readonly string[];
  contours?: readonly RtstructContourMetadata[];
}

export interface RtstructContourMetadata {
  geometricType?: string;
  pointCount: number;
  points?: readonly number[];
  referencedSopInstanceUids?: readonly string[];
}

export interface DicomMetadataReader {
  readonly id: string;
  readMetadata(input: ArrayBuffer | Blob): Promise<DicomMetadata | undefined>;
}

export function hasSeriesIdentity(metadata: DicomMetadata | undefined): metadata is DicomMetadata & {
  seriesInstanceUid: string;
  modality: string;
} {
  return Boolean(metadata?.seriesInstanceUid && metadata.modality);
}
