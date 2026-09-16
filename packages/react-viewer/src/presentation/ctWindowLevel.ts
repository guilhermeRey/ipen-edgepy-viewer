export interface CtWindowLevel {
  windowWidth: number;
  windowCenter: number;
}

export type CtWindowLevelPresetId = "soft" | "lung" | "bone";

export const CT_WINDOW_LEVEL_PRESETS: Array<{ id: CtWindowLevelPresetId; label: string; value: CtWindowLevel }> = [
  { id: "soft", label: "Soft tissue", value: { windowWidth: 400, windowCenter: 40 } },
  { id: "lung", label: "Lung", value: { windowWidth: 1500, windowCenter: -600 } },
  { id: "bone", label: "Bone", value: { windowWidth: 2000, windowCenter: 300 } },
];

export const DEFAULT_CT_WINDOW_LEVEL: CtWindowLevel = CT_WINDOW_LEVEL_PRESETS[0].value;

export interface ViewerWindowLevelInput {
  activeSeries: { modality?: string | undefined } | undefined;
  baseSeries: { modality?: string | undefined } | undefined;
  override: CtWindowLevel | undefined;
}

export interface ViewerWindowLevelState {
  control: CtWindowLevel;
  render: CtWindowLevel | undefined;
}

export function viewerWindowLevel(input: ViewerWindowLevelInput): ViewerWindowLevelState {
  const control = input.override ?? DEFAULT_CT_WINDOW_LEVEL;
  return {
    control,
    render: renderedSeriesCtWindowLevel(input.baseSeries ?? input.activeSeries, control, Boolean(input.override)),
  };
}

export function renderedSeriesCtWindowLevel(
  series: { modality?: string | undefined } | undefined,
  value: CtWindowLevel,
  hasExplicitValue: boolean,
): CtWindowLevel | undefined {
  if (hasExplicitValue || series?.modality?.toUpperCase() === "CT") {
    return value;
  }
  return undefined;
}

export function ctWindowLevelPreset(value: CtWindowLevel): CtWindowLevelPresetId | "custom" {
  return CT_WINDOW_LEVEL_PRESETS.find((preset) => (
    preset.value.windowWidth === value.windowWidth && preset.value.windowCenter === value.windowCenter
  ))?.id ?? "custom";
}

export function clampCtWindowLevel(value: CtWindowLevel): CtWindowLevel {
  return {
    windowWidth: clamp(Math.round(value.windowWidth), 1, 5000),
    windowCenter: clamp(Math.round(value.windowCenter), -1500, 1500),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
