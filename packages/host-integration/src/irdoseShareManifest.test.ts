import { describe, expect, it } from "vitest";
import {
  irdoseShareManifestToHostAssetManifest,
  isIrdoseShareManifestExpired,
  parseIrdoseShareManifest,
  validateIrdoseShareManifest,
  type IrdoseShareManifest,
} from "./index";

describe("IRDose share manifest", () => {
  it("parses a valid schema 1.0 manifest", () => {
    const manifest = parseIrdoseShareManifest(JSON.stringify(validIrdoseManifest()));

    expect(manifest.schema_version).toBe("1.0");
    expect(manifest.auth.token).toBe("00000000-0000-4000-8000-000000000001");
    expect(manifest.files.ct_reference.filename).toBe("ct_reference.zip");
    expect(manifest.files.activity_maps).toHaveLength(1);
    expect(manifest.files.targets).toHaveLength(2);
    expect(manifest.files.dose_maps).toHaveLength(2);
  });

  it("rejects unsupported schema versions", () => {
    expect(() => validateIrdoseShareManifest({ ...validIrdoseManifest(), schema_version: "2.0" })).toThrow("schema_version must be 1.0");
  });

  it("rejects unsafe package filenames", () => {
    const manifest = validIrdoseManifest();
    manifest.files.targets[0] = { ...manifest.files.targets[0], filename: "../target.zip" };

    expect(() => validateIrdoseShareManifest(manifest)).toThrow("files.targets[].filename must be a safe package filename");
  });

  it("detects expired manifests without making validation time-dependent", () => {
    const manifest = validateIrdoseShareManifest(validIrdoseManifest());

    expect(isIrdoseShareManifestExpired(manifest, new Date("2025-06-04T14:00:00.000Z"))).toBe(false);
    expect(isIrdoseShareManifestExpired(manifest, new Date("2025-06-05T14:00:00.000Z"))).toBe(true);
  });

  it("converts the share manifest to a package-level host asset manifest", () => {
    const manifest = validateIrdoseShareManifest(validIrdoseManifest());

    expect(irdoseShareManifestToHostAssetManifest(manifest)).toEqual({
      studyUid: "irdose-study-42",
      label: "IRDose SYNTHETIC-PATIENT-001 Lu-177",
      assets: [
        {
          path: "irdose/study-42/study-package.zip",
          url: "https://irdose.example.com/dosimetry/api/study-package/00000000-0000-4000-8000-000000000001/",
          kind: "archive",
          contentType: "application/zip",
          metadata: {
            source: "irdose-share-package",
            singleUse: true,
          },
        },
      ],
      metadata: {
        source: "irdose-share-package",
        schemaVersion: "1.0",
        generatedAt: "2025-06-03T14:00:00.000000+00:00",
        expiresAt: "2025-06-05T14:00:00.000000+00:00",
        study: {
          id: 42,
          isotope: "Lu-177",
          emissionType: "beta-",
          cumMethod: "map",
          status: "DONE",
        },
        patient: {
          patientId: "SYNTHETIC-PATIENT-001",
        },
        packageFiles: manifest.files,
      },
    });
  });
});

function validIrdoseManifest(): IrdoseShareManifest {
  return {
    schema_version: "1.0",
    generated_at: "2025-06-03T14:00:00.000000+00:00",
    expires_at: "2025-06-05T14:00:00.000000+00:00",
    single_use: true,
    auth: {
      token: "00000000-0000-4000-8000-000000000001",
      download_endpoint: "https://irdose.example.com/dosimetry/api/study-package/00000000-0000-4000-8000-000000000001/",
    },
    study: {
      id: 42,
      owner: "synthetic-user",
      created_at: "2025-06-01T10:30:00+00:00",
      isotope: "Lu-177",
      emission_type: "beta-",
      cum_method: "map",
      status: "DONE",
    },
    patient: {
      name: "Synthetic Patient",
      patient_id: "SYNTHETIC-PATIENT-001",
      birthdate: "1900-01-01",
    },
    files: {
      ct_reference: {
        ct_name: "CT_baseline",
        filename: "ct_reference.zip",
      },
      activity_maps: [
        {
          name: "SPECT_24h",
          post_injection_time_h: 24,
          unit: "MBq/mL",
          filename: "actmap_0_SPECT_24h.zip",
        },
      ],
      targets: [
        { name: "Liver", filename: "target_0_Liver.zip" },
        { name: "Kidney_L", filename: "target_1_Kidney_L.zip" },
      ],
      dose_maps: [
        { emission: "beta-", filename: "dose_beta-.zip" },
        { emission: "gamma", filename: "dose_gamma.zip" },
      ],
    },
  };
}
