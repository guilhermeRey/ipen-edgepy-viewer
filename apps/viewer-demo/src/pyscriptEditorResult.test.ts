import { describe, expect, it } from "vitest";
import { displayPyScriptResult, temporaryOverlayFromPyScriptResult } from "./pyscriptEditorResult";

describe("temporaryOverlayFromPyScriptResult", () => {
  it("normalizes a Python mask result for the renderer", () => {
    const overlay = temporaryOverlayFromPyScriptResult({ overlay: { width: 2, height: 1, sliceIndex: 3, values: [0, 1], color: "#fff" } });

    expect(overlay).toMatchObject({ width: 2, height: 1, sliceIndex: 3, color: "#fff" });
    expect(overlay?.values).toEqual(new Float32Array([0, 1]));
  });

  it("rejects masks with invalid dimensions", () => {
    expect(() => temporaryOverlayFromPyScriptResult({ overlay: { width: 2, height: 2, sliceIndex: 0, values: [1] } })).toThrow("one value per pixel");
  });

  it("removes pixel arrays from the visible result", () => {
    expect(displayPyScriptResult({ summary: { maximum: 2 }, overlay: { values: [0, 1] } })).toEqual({
      summary: { maximum: 2 },
      overlay: { valueCount: 2 },
    });
  });
});
