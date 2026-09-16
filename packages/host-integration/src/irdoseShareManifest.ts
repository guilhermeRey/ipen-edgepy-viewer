import type { HostAssetManifest } from "./hostAssetManifest";

export interface IrdoseShareManifest {
  schema_version: "1.0";
  generated_at: string;
  expires_at: string;
  single_use: boolean;
  auth: IrdoseShareAuth;
  study: IrdoseShareStudy;
  patient: IrdoseSharePatient;
  files: IrdoseShareFiles;
}

export interface IrdoseShareAuth {
  token: string;
  download_endpoint: string;
}

export interface IrdoseShareStudy {
  id: number;
  owner: string;
  created_at: string;
  isotope: string;
  emission_type?: string;
  cum_method: "map" | "curve";
  status: "pending" | "RUNNING" | "DONE" | "ERROR";
}

export interface IrdoseSharePatient {
  name?: string;
  patient_id: string;
  birthdate?: string;
}

export interface IrdoseShareFiles {
  ct_reference: IrdoseCtReferenceFile;
  activity_maps: IrdoseActivityMapFile[];
  targets: IrdoseTargetFile[];
  dose_maps: IrdoseDoseMapFile[];
}

export interface IrdoseCtReferenceFile {
  ct_name: string;
  filename: string;
}

export interface IrdoseActivityMapFile {
  name: string;
  post_injection_time_h?: number;
  unit?: string;
  filename: string;
}

export interface IrdoseTargetFile {
  name: string;
  filename: string;
}

export interface IrdoseDoseMapFile {
  emission: string;
  filename: string;
}

export function parseIrdoseShareManifest(value: string | unknown): IrdoseShareManifest {
  const parsed = typeof value === "string" ? parseManifestJson(value) : value;
  return validateIrdoseShareManifest(parsed);
}

export function validateIrdoseShareManifest(value: unknown): IrdoseShareManifest {
  const manifest = requireRecord(value, "manifest");
  requireLiteral(manifest.schema_version, "1.0", "schema_version");
  const auth = requireRecord(manifest.auth, "auth");
  const study = requireRecord(manifest.study, "study");
  const patient = requireRecord(manifest.patient, "patient");
  const files = requireRecord(manifest.files, "files");

  return {
    schema_version: "1.0",
    generated_at: requireIsoDateString(manifest.generated_at, "generated_at"),
    expires_at: requireIsoDateString(manifest.expires_at, "expires_at"),
    single_use: requireBoolean(manifest.single_use, "single_use"),
    auth: {
      token: requireString(auth.token, "auth.token"),
      download_endpoint: requireHttpUrl(auth.download_endpoint, "auth.download_endpoint"),
    },
    study: validateStudy(study),
    patient: {
      ...(typeof patient.name === "string" ? { name: patient.name } : {}),
      patient_id: requireString(patient.patient_id, "patient.patient_id"),
      ...(typeof patient.birthdate === "string" ? { birthdate: patient.birthdate } : {}),
    },
    files: validateFiles(files),
  };
}

export function isIrdoseShareManifestExpired(manifest: IrdoseShareManifest, now: Date = new Date()): boolean {
  return Date.parse(manifest.expires_at) <= now.getTime();
}

export function irdoseShareManifestToHostAssetManifest(manifest: IrdoseShareManifest): HostAssetManifest {
  return {
    studyUid: `irdose-study-${manifest.study.id}`,
    label: `IRDose ${manifest.patient.patient_id} ${manifest.study.isotope}`,
    assets: [
      {
        path: `irdose/study-${manifest.study.id}/study-package.zip`,
        url: manifest.auth.download_endpoint,
        kind: "archive",
        contentType: "application/zip",
        metadata: {
          source: "irdose-share-package",
          singleUse: manifest.single_use,
        },
      },
    ],
    metadata: {
      source: "irdose-share-package",
      schemaVersion: manifest.schema_version,
      generatedAt: manifest.generated_at,
      expiresAt: manifest.expires_at,
      study: {
        id: manifest.study.id,
        isotope: manifest.study.isotope,
        emissionType: manifest.study.emission_type,
        cumMethod: manifest.study.cum_method,
        status: manifest.study.status,
      },
      patient: {
        patientId: manifest.patient.patient_id,
      },
      packageFiles: manifest.files,
    },
  };
}

function validateStudy(study: Record<string, unknown>): IrdoseShareStudy {
  return {
    id: requireNumber(study.id, "study.id"),
    owner: requireString(study.owner, "study.owner"),
    created_at: requireIsoDateString(study.created_at, "study.created_at"),
    isotope: requireString(study.isotope, "study.isotope"),
    ...(typeof study.emission_type === "string" ? { emission_type: study.emission_type } : {}),
    cum_method: requireOneOf(study.cum_method, ["map", "curve"], "study.cum_method"),
    status: requireOneOf(study.status, ["pending", "RUNNING", "DONE", "ERROR"], "study.status"),
  };
}

function validateFiles(files: Record<string, unknown>): IrdoseShareFiles {
  return {
    ct_reference: validateCtReferenceFile(requireRecord(files.ct_reference, "files.ct_reference")),
    activity_maps: requireArray(files.activity_maps, "files.activity_maps").map((item, index) => validateActivityMapFile(requireRecord(item, `files.activity_maps[${index}]`))),
    targets: requireArray(files.targets, "files.targets").map((item, index) => validateTargetFile(requireRecord(item, `files.targets[${index}]`))),
    dose_maps: requireArray(files.dose_maps, "files.dose_maps").map((item, index) => validateDoseMapFile(requireRecord(item, `files.dose_maps[${index}]`))),
  };
}

function validateCtReferenceFile(file: Record<string, unknown>): IrdoseCtReferenceFile {
  return {
    ct_name: requireString(file.ct_name, "files.ct_reference.ct_name"),
    filename: requireSafePackageFilename(file.filename, "files.ct_reference.filename"),
  };
}

function validateActivityMapFile(file: Record<string, unknown>): IrdoseActivityMapFile {
  return {
    name: requireString(file.name, "files.activity_maps[].name"),
    ...(typeof file.post_injection_time_h === "number" ? { post_injection_time_h: file.post_injection_time_h } : {}),
    ...(typeof file.unit === "string" ? { unit: file.unit } : {}),
    filename: requireSafePackageFilename(file.filename, "files.activity_maps[].filename"),
  };
}

function validateTargetFile(file: Record<string, unknown>): IrdoseTargetFile {
  return {
    name: requireString(file.name, "files.targets[].name"),
    filename: requireSafePackageFilename(file.filename, "files.targets[].filename"),
  };
}

function validateDoseMapFile(file: Record<string, unknown>): IrdoseDoseMapFile {
  return {
    emission: requireString(file.emission, "files.dose_maps[].emission"),
    filename: requireSafePackageFilename(file.filename, "files.dose_maps[].filename"),
  };
}

function parseManifestJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid IRDose share manifest JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a boolean.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a finite number.`);
  }
  return value;
}

function requireIsoDateString(value: unknown, field: string): string {
  const result = requireString(value, field);
  if (!Number.isFinite(Date.parse(result))) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a valid ISO date string.`);
  }
  return result;
}

function requireHttpUrl(value: unknown, field: string): string {
  const result = requireString(value, field);
  let url: URL;
  try {
    url = new URL(result);
  } catch {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a valid URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Invalid IRDose share manifest: ${field} must be an HTTP(S) URL.`);
  }
  return result;
}

function requireSafePackageFilename(value: unknown, field: string): string {
  const result = requireString(value, field).replace(/\\/g, "/");
  if (result.startsWith("/") || result.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be a safe package filename.`);
  }
  return result;
}

function requireLiteral<T extends string>(value: unknown, expected: T, field: string): T {
  if (value !== expected) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be ${expected}.`);
  }
  return expected;
}

function requireOneOf<const T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Invalid IRDose share manifest: ${field} must be one of ${allowed.join(", ")}.`);
  }
  return value;
}
