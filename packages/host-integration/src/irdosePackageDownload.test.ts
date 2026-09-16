import { describe, expect, it, vi } from "vitest";
import {
  IrdosePackageDownloadError,
  downloadIrdoseStudyPackage,
  filenameFromContentDisposition,
  type IrdosePackageFetch,
  type IrdosePackageFetchResponse,
  type IrdoseShareManifest,
} from "./index";

describe("IRDose package download", () => {
  it("downloads the package zip from the manifest endpoint", async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const fetchPackage = vi.fn<IrdosePackageFetch>(async () => response({ data }));
    const abort = new AbortController();

    await expect(downloadIrdoseStudyPackage(validIrdoseManifest(), { fetch: fetchPackage, signal: abort.signal })).resolves.toEqual({
      data,
      contentType: "application/zip",
      filename: "study_42_SYNTHETIC-PATIENT-001_Lu-177_package.zip",
    });
    expect(fetchPackage).toHaveBeenCalledWith(
      "https://irdose.example.com/dosimetry/api/study-package/00000000-0000-4000-8000-000000000001/",
      { method: "GET", signal: abort.signal },
    );
  });

  it("throws a structured error for consumed or expired tokens", async () => {
    const fetchPackage = vi.fn<IrdosePackageFetch>(async () => response({
      ok: false,
      status: 403,
      json: async () => ({ error: "Token is invalid, expired, or has already been used." }),
    }));

    await expect(downloadIrdoseStudyPackage(validIrdoseManifest(), { fetch: fetchPackage })).rejects.toMatchObject({
      name: "IrdosePackageDownloadError",
      message: "Token is invalid, expired, or has already been used.",
      status: 403,
    } satisfies Partial<IrdosePackageDownloadError>);
  });

  it("uses the default 403 message when the server body is not readable", async () => {
    const fetchPackage = vi.fn<IrdosePackageFetch>(async () => response({ ok: false, status: 403 }));

    await expect(downloadIrdoseStudyPackage(validIrdoseManifest(), { fetch: fetchPackage })).rejects.toThrow("IRDose package token is invalid, expired, or has already been used.");
  });

  it("extracts only safe filenames from content disposition", () => {
    expect(filenameFromContentDisposition('attachment; filename="study.zip"')).toBe("study.zip");
    expect(filenameFromContentDisposition('attachment; filename="../study.zip"')).toBeUndefined();
    expect(filenameFromContentDisposition("attachment")).toBeUndefined();
  });
});

function response(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  data?: ArrayBuffer;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}): IrdosePackageFetchResponse {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    ...(options.statusText ? { statusText: options.statusText } : {}),
    headers: {
      get(name) {
        const headers = new Map([
          ["content-type", "application/zip"],
          ["content-disposition", 'attachment; filename="study_42_SYNTHETIC-PATIENT-001_Lu-177_package.zip"'],
        ]);
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    arrayBuffer: async () => options.data ?? new ArrayBuffer(0),
    ...(options.json ? { json: options.json } : {}),
    ...(options.text ? { text: options.text } : {}),
  };
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
      cum_method: "map",
      status: "DONE",
    },
    patient: {
      patient_id: "SYNTHETIC-PATIENT-001",
    },
    files: {
      ct_reference: { ct_name: "CT_baseline", filename: "ct_reference.zip" },
      activity_maps: [],
      targets: [],
      dose_maps: [],
    },
  };
}
