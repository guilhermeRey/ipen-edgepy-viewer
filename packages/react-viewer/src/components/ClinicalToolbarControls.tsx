import { useState } from "react";
import { MAX_CINE_FPS, MIN_CINE_FPS } from "../presentation/cinePlayback";
import { CT_WINDOW_LEVEL_PRESETS, ctWindowLevelPreset, type CtWindowLevel, type CtWindowLevelPresetId } from "../presentation/ctWindowLevel";
import type { ClinicalViewportState } from "../ports/viewportRenderer";

interface ClinicalToolbarControlsProps {
  ctWindowLevel: CtWindowLevel;
  cineFps: number;
  isCinePlaying: boolean;
  viewportState?: ClinicalViewportState | undefined;
  onCtWindowLevelChange(value: CtWindowLevel): void;
  onCineFpsChange(value: number): void;
  onCineToggle(): void;
  onResetView(): void;
  onSliceSelect(sliceIndex: number): void;
  onSliceStep(delta: number): void;
}

export function ClinicalToolbarControls({
  ctWindowLevel,
  cineFps,
  isCinePlaying,
  viewportState,
  onCtWindowLevelChange,
  onCineFpsChange,
  onCineToggle,
  onResetView,
  onSliceSelect,
  onSliceStep,
}: Readonly<ClinicalToolbarControlsProps>) {
  const [expanded, setExpanded] = useState(false);
  const canNavigate = Boolean(viewportState && viewportState.sliceCount > 1);
  return (
    <div className="pycom-next-clinical-tools-wrap">
      <div className="pycom-next-clinical-tools" aria-label="Clinical viewport tools">
        <label className="pycom-next-tool-select">
          <span>CT</span>
          <select value={ctWindowLevelPreset(ctWindowLevel)} onChange={(event) => setCtPreset(event.currentTarget.value, onCtWindowLevelChange)}>
            {CT_WINDOW_LEVEL_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
            <option value="custom">Custom</option>
          </select>
        </label>
        <ToolButton icon="reset" label="Reset view" onClick={onResetView} />
        <ToolButton disabled={!canNavigate} icon="previous" label="Previous slice" onClick={() => onSliceStep(-1)} />
        <span className="pycom-next-slice-indicator" aria-label="Current slice">
          {viewportState ? `${viewportState.sliceIndex + 1}/${viewportState.sliceCount}` : "--/--"}
        </span>
        <ToolButton disabled={!canNavigate} icon="next" label="Next slice" onClick={() => onSliceStep(1)} />
        <ToolButton disabled={!canNavigate} icon={isCinePlaying ? "pause" : "play"} label={isCinePlaying ? "Pause cine" : "Play cine"} pressed={isCinePlaying} onClick={onCineToggle} />
        <ToolButton icon="settings" label={expanded ? "Hide playback tools" : "Show playback tools"} pressed={expanded} onClick={() => setExpanded((value) => !value)} />
      </div>
      {expanded ? <ExpandedTools cineFps={cineFps} canNavigate={canNavigate} viewportState={viewportState} onCineFpsChange={onCineFpsChange} onSliceSelect={onSliceSelect} /> : null}
    </div>
  );
}

function ExpandedTools({
  cineFps,
  canNavigate,
  viewportState,
  onCineFpsChange,
  onSliceSelect,
}: Readonly<{
  cineFps: number;
  canNavigate: boolean;
  viewportState?: ClinicalViewportState | undefined;
  onCineFpsChange(value: number): void;
  onSliceSelect(sliceIndex: number): void;
}>) {
  return (
    <div className="pycom-next-clinical-tools-expanded" aria-label="Expanded viewport tools">
      <label>
        <span>Slice</span>
        <input type="range" min="1" max={viewportState?.sliceCount ?? 1} step="1" value={viewportState ? viewportState.sliceIndex + 1 : 1} disabled={!canNavigate} onChange={(event) => onSliceSelect(Number(event.currentTarget.value) - 1)} />
      </label>
      <label>
        <span>FPS</span>
        <input type="range" min={MIN_CINE_FPS} max={MAX_CINE_FPS} step="1" value={cineFps} onChange={(event) => onCineFpsChange(Number(event.currentTarget.value))} />
        <strong>{cineFps}</strong>
      </label>
    </div>
  );
}

function setCtPreset(value: string, onChange: (value: CtWindowLevel) => void): void {
  const preset = CT_WINDOW_LEVEL_PRESETS.find((item) => item.id === (value as CtWindowLevelPresetId));
  if (preset) {
    onChange(preset.value);
  }
}

function ToolButton({ disabled, icon, label, pressed, onClick }: Readonly<{ disabled?: boolean; icon: ToolIconName; label: string; pressed?: boolean; onClick(): void }>) {
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} className="pycom-next-tool-button" disabled={disabled} onClick={onClick}>
      <ToolIcon name={icon} />
    </button>
  );
}

type ToolIconName = "next" | "pause" | "play" | "previous" | "reset" | "settings";

function ToolIcon({ name }: Readonly<{ name: ToolIconName }>) {
  if (name === "play") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>;
  }
  if (name === "pause") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14" /><path d="M16 5v14" /></svg>;
  }
  if (name === "previous") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /><path d="M6 6v12" /></svg>;
  }
  if (name === "next") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /><path d="M18 6v12" /></svg>;
  }
  if (name === "settings") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.7" /><path d="M18 3v6h-6" /><path d="M20 12a8 8 0 0 1-13.7 5.7" /><path d="M6 21v-6h6" /></svg>;
}
