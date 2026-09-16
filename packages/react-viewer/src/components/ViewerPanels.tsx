import type { ReactNode } from "react";
import type { ClinicalScan, ClinicalStudy, DicomSeriesRef, OverlayKind, OverlayRef } from "@pycom-next/core";

interface StudyPanelProps {
  study: ClinicalStudy;
  activeScan?: ClinicalScan | undefined;
  actions?: ReactNode;
  onScanSelect(scan: ClinicalScan): void;
}

export function StudyPanel({ study, activeScan, actions, onScanSelect }: Readonly<StudyPanelProps>) {
  return (
    <aside className="pycom-next-panel pycom-next-study-panel">
      <header className="pycom-next-panel-header">
        <span className="pycom-next-eyebrow">Navigation</span>
        <h2>Scans</h2>
        <p className="pycom-next-study-label">{study.label}</p>
      </header>
      <StudySummary study={study} />
      {study.scans.length === 0 ? <EmptyStudy actions={actions} /> : null}
      {study.scans.length > 0 ? <ScanList study={study} activeScan={activeScan} onScanSelect={onScanSelect} /> : null}
      {actions && study.scans.length > 0 ? (
        <section className="pycom-next-panel-section" aria-label="Add acquisition">
          <h3>Add acquisition</h3>
          <div className="pycom-next-panel-actions">{actions}</div>
        </section>
      ) : null}
    </aside>
  );
}

function StudySummary({ study }: Readonly<{ study: ClinicalStudy }>) {
  return (
    <dl className="pycom-next-study-summary" aria-label="Study summary">
      <Metric label="Scans" value={study.scans.length} />
      <Metric label="Series" value={study.series.length} />
      <Metric label="Overlays" value={study.overlays.length} />
    </dl>
  );
}

function EmptyStudy({ actions }: Readonly<{ actions?: ReactNode | undefined }>) {
  return (
    <section className="pycom-next-empty-study">
      <span>No acquisitions loaded yet.</span>
      <p className="pycom-next-muted">Import CT/SPECT data or load a host manifest to start reviewing a study.</p>
      {actions ? <div className="pycom-next-panel-actions">{actions}</div> : null}
    </section>
  );
}

function ScanList({ study, activeScan, onScanSelect }: Readonly<StudyPanelProps>) {
  return (
    <section className="pycom-next-panel-section" aria-label="Clinical scans">
      <div className="pycom-next-section-heading">
        <span>Loaded acquisitions</span>
        <small>{study.scans.length}</small>
      </div>
      <ol className="pycom-next-list pycom-next-scan-list">
        {study.scans.map((scan) => (
          <li key={scan.id} className={scan.id === activeScan?.id ? "is-active" : undefined}>
            <ScanButton scan={scan} study={study} active={scan.id === activeScan?.id} onScanSelect={onScanSelect} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ScanButton({ scan, study, active, onScanSelect }: Readonly<{ scan: ClinicalScan; study: ClinicalStudy; active: boolean; onScanSelect(scan: ClinicalScan): void }>) {
  const baseSeries = seriesByUid(study.series, scan.baseSeriesUid);
  const functionalSeries = seriesByUid(study.series, scan.functionalSeriesUid);
  const overlays = overlaysForScan(study.overlays, scan);
  return (
    <button type="button" className="pycom-next-scan-button" aria-current={active ? "true" : undefined} onClick={() => onScanSelect(scan)}>
      <span className="pycom-next-scan-button-header">
        <strong>{scan.label}</strong>
        {active ? <span className="pycom-next-scan-active-pill">Active</span> : null}
      </span>
      <span className="pycom-next-scan-modalities">
        <SeriesLine label="Base" series={baseSeries} />
        <SeriesLine label="Fusion" series={functionalSeries} />
      </span>
      <OverlaySummary overlays={overlays} />
    </button>
  );
}

function SeriesLine({ label, series }: Readonly<{ label: string; series?: DicomSeriesRef | undefined }>) {
  return (
    <span className="pycom-next-scan-modality">
      <small>{label}</small>
      <strong>{seriesSummary(series)}</strong>
    </span>
  );
}

function OverlaySummary({ overlays }: Readonly<{ overlays: readonly OverlayRef[] }>) {
  const counts = overlayCounts(overlays);
  return (
    <span className="pycom-next-scan-overlays" aria-label={`${overlays.length} overlays`}>
      <small>{overlays.length} overlays</small>
      <span>{counts.length > 0 ? counts.map(formatOverlayCount).join(" · ") : "No overlays"}</span>
    </span>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function seriesByUid(series: readonly DicomSeriesRef[], uid: string | undefined): DicomSeriesRef | undefined {
  return series.find((item) => item.uid === uid);
}

function seriesSummary(series: DicomSeriesRef | undefined): string {
  if (!series) {
    return "Not loaded";
  }
  const modality = series.modality ?? series.role;
  return `${modality} · ${series.instanceCount} img`;
}

function overlaysForScan(overlays: readonly OverlayRef[], scan: ClinicalScan): OverlayRef[] {
  return overlays.filter((overlay) => scan.overlayUids.includes(overlay.uid));
}

function overlayCounts(overlays: readonly OverlayRef[]): Array<{ kind: OverlayKind; count: number }> {
  const counts = new Map<OverlayKind, number>();
  for (const overlay of overlays) {
    counts.set(overlay.kind, (counts.get(overlay.kind) ?? 0) + 1);
  }
  return Array.from(counts, ([kind, count]) => ({ kind, count }));
}

function formatOverlayCount(item: Readonly<{ kind: OverlayKind; count: number }>): string {
  return `${item.count} ${item.kind}`;
}
