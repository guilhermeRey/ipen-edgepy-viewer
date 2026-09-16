import { assembleClinicalStudy, type ClinicalStudy } from "@pycom-next/core";
import {
  buildDicomInventory,
  createClinicalStudyInputFromDicomInventory,
  type DicomInventoryEntry,
} from "@pycom-next/dicom";

export function createDemoStudy(): ClinicalStudy {
  const entries: DicomInventoryEntry[] = [
    imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/001.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "demo-scan1-ct" }),
    imageEntry({ path: "Patient/SPECT_CTs/scan1/ct/002.dcm", scanId: "Scan1", modality: "CT", seriesInstanceUid: "demo-scan1-ct" }),
    imageEntry({ path: "Patient/SPECT_CTs/scan1/spect/001.dcm", scanId: "Scan1", modality: "NM", seriesInstanceUid: "demo-scan1-spect" }),
    imageEntry({ path: "Patient/SPECT_CTs/scan2/ct/001.dcm", scanId: "Scan2", modality: "CT", seriesInstanceUid: "demo-scan2-ct" }),
    imageEntry({ path: "Patient/SPECT_CTs/scan2/pet/001.dcm", scanId: "Scan2", modality: "PT", seriesInstanceUid: "demo-scan2-pet" }),
    { path: "Patient/VOI/scan1/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan1" },
    { path: "Patient/VOI/scan1/Masks/Lesions/lesion1/001.dcm", kind: "mask", scanId: "Scan1" },
    { path: "Patient/VOI/scan2/Masks/Organs/liver/001.dcm", kind: "mask", scanId: "Scan2" },
    { path: "Patient/VOI/scan2/RTstructs/Organs/liver.dcm", kind: "rtstruct", scanId: "Scan2" },
  ];

  return assembleClinicalStudy(
    createClinicalStudyInputFromDicomInventory(
      { entries, series: buildDicomInventory(entries) },
      { uid: "demo-patient-4", label: "Demo Patient 4" },
    ),
  );
}

interface ImageEntryInput {
  path: string;
  scanId: string;
  modality: string;
  seriesInstanceUid: string;
}

function imageEntry({ path, scanId, modality, seriesInstanceUid }: ImageEntryInput): DicomInventoryEntry {
  return {
    path,
    kind: "image",
    scanId,
    metadata: { modality, seriesInstanceUid },
  };
}
