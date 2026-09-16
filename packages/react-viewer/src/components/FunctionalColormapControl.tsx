import {
  FUNCTIONAL_OVERLAY_COLORMAPS,
  functionalOverlayColormapLabel,
  type FunctionalOverlayColormap,
} from "../presentation/overlayPresentation";

interface FunctionalColormapControlProps {
  value: FunctionalOverlayColormap;
  onChange(value: FunctionalOverlayColormap): void;
}

export function FunctionalColormapControl({ value, onChange }: Readonly<FunctionalColormapControlProps>) {
  return (
    <label className="pycom-next-colormap-control">
      <span>Colormap</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as FunctionalOverlayColormap)}>
        {FUNCTIONAL_OVERLAY_COLORMAPS.map((colormap) => (
          <option key={colormap} value={colormap}>{functionalOverlayColormapLabel(colormap)}</option>
        ))}
      </select>
      <span className={`pycom-next-colormap-ramp pycom-next-colormap-ramp-${value}`} aria-hidden="true" />
    </label>
  );
}
