import { describe, expect, it } from "vitest";
import { roiFromPoints } from "./rectangularRoi";

describe("rectangular ROI pixel boundaries", () => {
  const image = { width: 4, height: 4 };
  it("selects the same central four pixels in either drag direction", () => {
    expect(roiFromPoints([1, 1], [3, 3], image)).toEqual({ x0: 1, x1: 3, y0: 1, y1: 3 });
    expect(roiFromPoints([3, 3], [1, 1], image)).toEqual({ x0: 1, x1: 3, y0: 1, y1: 3 });
  });
  it("rounds to boundaries, clips out-of-image drags and keeps clicks empty", () => {
    expect(roiFromPoints([1.2, 0.8], [99, -4], image)).toEqual({ x0: 1, x1: 4, y0: 0, y1: 1 });
    expect(roiFromPoints([1.2, 2.8], [1.2, 2.8], image)).toEqual({ x0: 1, x1: 1, y0: 3, y1: 3 });
  });
});
