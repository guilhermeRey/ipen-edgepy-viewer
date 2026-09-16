import { CT_WINDOW_LEVEL_PRESETS, DEFAULT_CT_WINDOW_LEVEL, clampCtWindowLevel, ctWindowLevelPreset, type CtWindowLevel, type CtWindowLevelPresetId } from "../presentation/ctWindowLevel";

interface CtWindowLevelControlProps {
  value: CtWindowLevel;
  onChange(value: CtWindowLevel): void;
}

export function CtWindowLevelControl({ value, onChange }: Readonly<CtWindowLevelControlProps>) {
  const preset = ctWindowLevelPreset(value);
  const update = (next: CtWindowLevel) => onChange(clampCtWindowLevel(next));
  return (
    <section className="pycom-next-window-level">
      <header>
        <h3>CT window</h3>
        <button type="button" onClick={() => onChange(DEFAULT_CT_WINDOW_LEVEL)}>Reset</button>
      </header>
      <label>
        <span>Preset</span>
        <select value={preset} onChange={(event) => onPresetChange(event.currentTarget.value, onChange)}>
          {CT_WINDOW_LEVEL_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>
        <span>Window</span>
        <input type="range" min="1" max="5000" step="10" value={value.windowWidth} onChange={(event) => update({ ...value, windowWidth: Number(event.currentTarget.value) })} />
        <strong>{value.windowWidth}</strong>
      </label>
      <label>
        <span>Level</span>
        <input type="range" min="-1500" max="1500" step="10" value={value.windowCenter} onChange={(event) => update({ ...value, windowCenter: Number(event.currentTarget.value) })} />
        <strong>{value.windowCenter}</strong>
      </label>
    </section>
  );
}

function onPresetChange(value: string, onChange: (value: CtWindowLevel) => void): void {
  const preset = CT_WINDOW_LEVEL_PRESETS.find((item) => item.id === (value as CtWindowLevelPresetId));
  if (preset) {
    onChange(preset.value);
  }
}
