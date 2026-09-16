import { describe, expect, it } from "vitest";
import { DEFAULT_CT_WINDOW_LEVEL, clampCtWindowLevel, ctWindowLevelPreset, renderedSeriesCtWindowLevel, viewerWindowLevel } from "./ctWindowLevel";

describe("CT window level", () => {
  it("detects presets and custom values", () => {
    expect(ctWindowLevelPreset(DEFAULT_CT_WINDOW_LEVEL)).toBe("soft");
    expect(ctWindowLevelPreset({ windowWidth: 123, windowCenter: 45 })).toBe("custom");
  });

  it("clamps values to supported UI range", () => {
    expect(clampCtWindowLevel({ windowWidth: -10, windowCenter: 2000 })).toEqual({ windowWidth: 1, windowCenter: 1500 });
    expect(clampCtWindowLevel({ windowWidth: 5001, windowCenter: -1600 })).toEqual({ windowWidth: 5000, windowCenter: -1500 });
  });

  it("applies the default CT window only to CT series", () => {
    expect(renderedSeriesCtWindowLevel({ modality: "CT" }, DEFAULT_CT_WINDOW_LEVEL, false)).toBe(DEFAULT_CT_WINDOW_LEVEL);
    expect(renderedSeriesCtWindowLevel({ modality: "MG" }, DEFAULT_CT_WINDOW_LEVEL, false)).toBeUndefined();
  });

  it("keeps explicit user window-level changes for non-CT series", () => {
    const value = { windowWidth: 1200, windowCenter: 600 };

    expect(renderedSeriesCtWindowLevel({ modality: "MG" }, value, true)).toBe(value);
    expect(viewerWindowLevel({ activeSeries: { modality: "MG" }, baseSeries: undefined, override: value })).toEqual({ control: value, render: value });
  });
});
