interface LayerOpacityControlProps {
  label: string;
  value: number;
  onChange(value: number): void;
}

export function LayerOpacityControl({ label, value, onChange }: Readonly<LayerOpacityControlProps>) {
  return (
    <label className="pycom-next-opacity-control">
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <strong>{Math.round(value * 100)}%</strong>
    </label>
  );
}
