import { describe, expect, it } from "vitest";
import { normalizeHostStudyCommand, normalizeLogicalPath, type HostStudyCommand } from "./index";

describe("host integration", () => {
  it("normalizes safe host asset paths", () => {
    expect(normalizeLogicalPath("./scan1\\ct\\001.dcm")).toBe("scan1/ct/001.dcm");
  });

  it("rejects unsafe host asset paths", () => {
    expect(() => normalizeLogicalPath("/etc/passwd")).toThrow("Invalid host asset logical path");
    expect(() => normalizeLogicalPath("../scan/001.dcm")).toThrow("Invalid host asset logical path");
  });

  it("normalizes incremental add-series asset paths", () => {
    const command: HostStudyCommand = {
      type: "add-series",
      seriesUid: "scan1-ct",
      label: "Scan1 CT",
      role: "base",
      scanId: "Scan1",
      assets: [{ path: "./scan1\\ct\\001.dcm", kind: "dicom" }],
    };

    expect(normalizeHostStudyCommand(command)).toEqual({
      ...command,
      assets: [{ path: "scan1/ct/001.dcm", kind: "dicom" }],
    });
  });

  it("normalizes replace-study manifest asset paths", () => {
    const command: HostStudyCommand = {
      type: "replace-study",
      manifest: { assets: [{ path: "./scan1/ct/001.dcm" }] },
    };

    expect(normalizeHostStudyCommand(command)).toEqual({
      type: "replace-study",
      manifest: { assets: [{ path: "scan1/ct/001.dcm" }] },
    });
  });
});
