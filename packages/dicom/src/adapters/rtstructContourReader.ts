import { parseDicom } from "dicom-parser";
import type { DicomMetadata } from "../metadata";
import { rtstructContourMetadataFromDataSet } from "./rtstructMetadata";

export async function readRtstructContourMetadata(input: ArrayBuffer | Blob): Promise<DicomMetadata["rtstruct"] | undefined> {
  try {
    const bytes = new Uint8Array(isBlob(input) ? await input.arrayBuffer() : input);
    return rtstructContourMetadataFromDataSet(parseDicom(bytes));
  } catch {
    return undefined;
  }
}

function isBlob(input: ArrayBuffer | Blob): input is Blob {
  return typeof Blob !== "undefined" && input instanceof Blob;
}
