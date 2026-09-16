import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { IrdosePackageUnpackError, unpackIrdoseStudyPackage, type IrdoseShareManifest } from "./index";

describe("IRDose package unpack", () => {
  it("unpacks the nested ZIPs described by the manifest", async () => {
    const manifest = validIrdoseManifest();
    const packageZip = await createPackageZip({
      "ct_reference/ct_reference.zip": {
        "001.dcm": "ct-1",
        "002.dcm": "ct-2",
      },
      "activity_maps/actmap_0_SPECT_24h.zip": {
        "activity.mhd": "mhd",
        "activity.raw": "raw",
      },
      "targets/target_0_Liver.zip": {
        "liver.mhd": "mhd",
        "liver.raw": "raw",
      },
      "dose_maps/dose_beta-.zip": {
        "patient_beta--Dose.mhd": "mhd",
        "patient_beta--Dose.raw": "raw",
      },
    });

    const unpacked = await unpackIrdoseStudyPackage(manifest, packageZip);

    expect(unpacked.ctReference).toMatchObject({
      name: "CT_baseline",
      filename: "ct_reference.zip",
      files: [
        { path: "ct_reference/ct_reference/001.dcm", source: "ct_reference", sourceName: "CT_baseline", sourceFilename: "ct_reference.zip" },
        { path: "ct_reference/ct_reference/002.dcm", source: "ct_reference", sourceName: "CT_baseline", sourceFilename: "ct_reference.zip" },
      ],
    });
    expect(unpacked.activityMaps[0]).toMatchObject({
      name: "SPECT_24h",
      filename: "actmap_0_SPECT_24h.zip",
      postInjectionTimeH: 24,
      unit: "MBq/mL",
      files: [
        { path: "activity_maps/actmap_0_SPECT_24h/activity.mhd", source: "activity_map", sourceName: "SPECT_24h" },
        { path: "activity_maps/actmap_0_SPECT_24h/activity.raw", source: "activity_map", sourceName: "SPECT_24h" },
      ],
    });
    expect(unpacked.targets[0].files.map((file) => file.path)).toEqual([
      "targets/target_0_Liver/liver.mhd",
      "targets/target_0_Liver/liver.raw",
    ]);
    expect(unpacked.doseMaps[0].files.map((file) => file.path)).toEqual([
      "dose_maps/dose_beta-/patient_beta--Dose.mhd",
      "dose_maps/dose_beta-/patient_beta--Dose.raw",
    ]);
    expect(textFromBuffer(unpacked.ctReference.files[0].data)).toBe("ct-1");
  });

  it("throws when a manifest entry is missing from the package", async () => {
    const packageZip = await createPackageZip({
      "ct_reference/ct_reference.zip": { "001.dcm": "ct" },
    });

    await expect(unpackIrdoseStudyPackage(validIrdoseManifest(), packageZip)).rejects.toMatchObject({
      name: "IrdosePackageUnpackError",
      message: "IRDose package is missing nested ZIP: activity_maps/actmap_0_SPECT_24h.zip",
    } satisfies Partial<IrdosePackageUnpackError>);
  });

  it("rejects unsafe package paths from the manifest", async () => {
    const manifest = validIrdoseManifest();
    manifest.files.ct_reference.filename = "../ct_reference.zip";
    const packageZip = await createPackageZip({
      "ct_reference/ct_reference.zip": { "001.dcm": "ct" },
      "activity_maps/actmap_0_SPECT_24h.zip": { "activity.mhd": "mhd" },
      "targets/target_0_Liver.zip": { "liver.mhd": "mhd" },
      "dose_maps/dose_beta-.zip": { "dose.mhd": "mhd" },
    });

    await expect(unpackIrdoseStudyPackage(manifest, packageZip)).rejects.toThrow("Invalid IRDose package path: ct_reference/../ct_reference.zip");
  });
});

async function createPackageZip(filesByNestedZipPath: Record<string, Record<string, string>>): Promise<ArrayBuffer> {
  const packageZip = new JSZip();
  for (const [nestedZipPath, files] of Object.entries(filesByNestedZipPath)) {
    const nestedZip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
      nestedZip.file(path, content);
    }
    packageZip.file(nestedZipPath, await nestedZip.generateAsync({ type: "arraybuffer" }));
  }
  return packageZip.generateAsync({ type: "arraybuffer" });
}

function textFromBuffer(value: ArrayBuffer): string {
  return new TextDecoder().decode(value);
}

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
      patient_id: "SYNTHETIC-PATIENT-001",
    },
    files: {
      ct_reference: { ct_name: "CT_baseline", filename: "ct_reference.zip" },
      activity_maps: [
        {
          name: "SPECT_24h",
          post_injection_time_h: 24,
          unit: "MBq/mL",
          filename: "actmap_0_SPECT_24h.zip",
        },
      ],
      targets: [{ name: "Liver", filename: "target_0_Liver.zip" }],
      dose_maps: [{ emission: "beta-", filename: "dose_beta-.zip" }],
    },
  };
}
