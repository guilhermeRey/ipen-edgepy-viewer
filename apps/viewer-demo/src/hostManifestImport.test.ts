import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { localImportFilesFromHostManifestUrl } from "./hostManifestImport";

describe("host manifest import", () => {
  it("fetches a HostAssetManifest and expands archive assets", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://irdose.test/api/studies/1/viewer-assets/") {
        return jsonResponse({
          studyUid: "study-1",
          label: "Study 1",
          assets: [{ path: "acquisitions/scan1/ct.zip", url: "/archives/ct.zip", kind: "archive" }],
        });
      }
      if (url === "https://irdose.test/archives/ct.zip") {
        return new Response(await zipBlob({ "ct/001.dcm": "dicom" }), { status: 200 });
      }
      return new Response("missing", { status: 404, statusText: "Not Found" });
    }) as typeof fetch;

    const result = await localImportFilesFromHostManifestUrl("https://irdose.test/api/studies/1/viewer-assets/", { fetch: fetcher });

    expect(result.manifest).toMatchObject({ studyUid: "study-1", label: "Study 1" });
    expect(result.files.map((file) => file.path)).toEqual(["acquisitions/scan1/ct/001.dcm"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, status: 200 });
}

async function zipBlob(entries: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "blob" });
}
