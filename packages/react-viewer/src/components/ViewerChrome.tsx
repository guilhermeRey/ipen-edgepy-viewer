import type { ReactNode } from "react";
import type { ClinicalScan, DicomSeriesRef } from "@pycom-next/core";

interface ViewerChromeProps {
  title: string;
  studyLabel: string;
  activeScan?: ClinicalScan | undefined;
  activeSeries?: DicomSeriesRef | undefined;
  baseSeries?: DicomSeriesRef | undefined;
  functionalSeries?: DicomSeriesRef | undefined;
  toolbarActions?: ReactNode;
}

export function ViewerChrome({
  title,
  studyLabel,
  activeScan,
  activeSeries,
  baseSeries,
  functionalSeries,
  toolbarActions,
}: Readonly<ViewerChromeProps>) {
  return (
    <header className="pycom-next-viewport-toolbar" aria-label="Viewer controls">
      <div className="pycom-next-toolbar-brand">
        <ViewerIcon />
        <div className="pycom-next-toolbar-title">
          <strong>{title}</strong>
          <span>{studyLabel}</span>
        </div>
      </div>
      <div className="pycom-next-toolbar-context" aria-label="Active viewport context">
        <ContextChip label="Scan" value={activeScan?.label ?? "None"} />
        <ContextChip label="Active" value={activeSeries?.label ?? "None"} />
        <ContextChip label="Base" value={seriesSummary(baseSeries)} />
        <ContextChip label="Fusion" value={seriesSummary(functionalSeries)} />
      </div>
      {toolbarActions ? <div className="pycom-next-toolbar-extra">{toolbarActions}</div> : null}
    </header>
  );
}

function ContextChip({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <span className="pycom-next-context-chip">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function seriesSummary(series: DicomSeriesRef | undefined): string {
  return series ? [series.modality, series.instanceCount ? `${series.instanceCount} img` : undefined].filter(Boolean).join(" / ") || series.label : "None";
}

function ViewerIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <radialGradient id="edgepyToolbarCyan" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#8FFBEF" />
          <stop offset="45%" stopColor="#2BE3D2" />
          <stop offset="100%" stopColor="#0E96AE" />
        </radialGradient>
        <radialGradient id="edgepyToolbarGold" cx="62%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#FFEFA8" />
          <stop offset="48%" stopColor="#FFD23F" />
          <stop offset="100%" stopColor="#E08A12" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="60" r="25" fill="none" stroke="url(#edgepyToolbarCyan)" strokeWidth="8" opacity="0.95" />
      <circle cx="72" cy="60" r="25" fill="none" stroke="url(#edgepyToolbarGold)" strokeWidth="8" opacity="0.95" />
      <circle cx="60" cy="38" r="4.5" fill="#ffffff" opacity="0.75" />
      <circle cx="60" cy="82" r="4.5" fill="#ffffff" opacity="0.75" />
      <ellipse cx="38" cy="46" rx="6" ry="2.6" fill="#ffffff" opacity="0.3" transform="rotate(-32 38 46)" />
    </svg>
  );
}
