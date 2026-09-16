import { useEffect, useRef, useState } from "react";
import {
  downloadIrdoseStudyPackage,
  isIrdoseShareManifestExpired,
  listenForIrdoseShareManifest,
  parseIrdoseShareManifest,
  unpackIrdoseStudyPackage,
  type IrdoseShareManifest,
  type IrdoseUnpackedStudyPackage,
} from "@pycom-next/host-integration";

interface DemoIrdosePanelProps {
  enabled: boolean;
}

interface IrdosePackageSummary {
  ctFiles: number;
  activityMaps: Array<{ name: string; files: number }>;
  targets: Array<{ name: string; files: number }>;
  doseMaps: Array<{ emission: string; files: number }>;
}

type DownloadState = "idle" | "downloading" | "done" | "failed";

interface MutableValueRef<T> {
  current: T;
}

interface IrdoseStateSetters {
  setManifest(manifest: IrdoseShareManifest | undefined): void;
  setSummary(summary: IrdosePackageSummary | undefined): void;
  setDownloadState(state: DownloadState): void;
  setError(error: string | undefined): void;
}

const IRDOSE_VIEWER_READY_MESSAGE_TYPE = "irdose-viewer-ready";
const IRDOSE_MANIFEST_RECEIVED_MESSAGE_TYPE = "irdose-manifest-received";

export function DemoIrdosePanel({ enabled }: Readonly<DemoIrdosePanelProps>) {
  const abortRef = useRef<AbortController | null>(null);
  const [allowedOrigin, setAllowedOrigin] = useState(() => defaultAllowedOrigin());
  const [downloadState, setDownloadState] = useState<DownloadState>("idle");
  const [error, setError] = useState<string | undefined>(undefined);
  const [manifestUrl] = useState(() => defaultManifestUrl());
  const [manifest, setManifest] = useState<IrdoseShareManifest | undefined>(undefined);
  const [manifestText, setManifestText] = useState("");
  const [open, setOpen] = useState(() => hasIrdoseAllowedOriginParam());
  const [summary, setSummary] = useState<IrdosePackageSummary | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    return listenForIrdoseShareManifest({
      allowedOrigins: [allowedOrigin],
      onManifest(nextManifest) {
        setManifest(nextManifest);
        setSummary(undefined);
        setDownloadState("idle");
        setError(undefined);
        setOpen(true);
        notifyIrdoseOpener(allowedOrigin, IRDOSE_MANIFEST_RECEIVED_MESSAGE_TYPE);
      },
      onError(nextError) {
        setError(nextError.message);
      },
    });
  }, [allowedOrigin, enabled]);

  useEffect(() => {
    notifyIrdoseOpener(allowedOrigin, IRDOSE_VIEWER_READY_MESSAGE_TYPE);
  }, [allowedOrigin]);

  useEffect(() => {
    if (!enabled || !manifestUrl) {
      return undefined;
    }
    const abortController = new AbortController();
    void loadManifestFromUrl(manifestUrl, abortController.signal, { setManifest, setSummary, setDownloadState, setError });
    return () => abortController.abort();
  }, [enabled, manifestUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!enabled) {
    return null;
  }

  const expired = manifest ? isIrdoseShareManifestExpired(manifest) : false;
  const panelLabel = irdosePanelLabel({ manifest, expired, manifestUrl });
  const downloadLabel = downloadStateLabel(downloadState);
  return (
    <div className="demo-irdose-panel" data-open={open ? "true" : "false"}>
      <button type="button" className="demo-import-panel-toggle demo-irdose-panel-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IrdoseIcon />
        <span>IRDose</span>
      </button>
      {open ? (
        <div className="demo-import-panel-body demo-irdose-panel-body" role="menu" aria-label="IRDose share package menu">
          <header className="demo-irdose-panel-header">
            <h3>IRDose Share Package</h3>
            <small>{panelLabel}</small>
          </header>
          <label className="demo-irdose-origin-field">
            <span>Allowed origin</span>
            <input value={allowedOrigin} onChange={(event) => setAllowedOrigin(event.currentTarget.value)} />
          </label>
          <section className="demo-import-section">
            <h3>Manual test manifest</h3>
            <textarea value={manifestText} placeholder="Paste IRDose manifest JSON" onChange={(event) => setManifestText(event.currentTarget.value)} />
            <button type="button" onClick={() => loadPastedManifest(manifestText, { setManifest, setSummary, setDownloadState, setError })}>Load pasted manifest</button>
          </section>
          {manifest ? <ManifestCard manifest={manifest} expired={expired} /> : null}
          <div className="demo-import-panel-actions">
            <button type="button" disabled={!manifest || downloadState === "downloading"} onClick={() => void downloadAndUnpack(manifest, abortRef, { setManifest, setSummary, setDownloadState, setError })}>
              {downloadLabel}
            </button>
            <button type="button" disabled={downloadState !== "downloading"} onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
          {error ? <p className="demo-irdose-error">{error}</p> : null}
          {summary ? <PackageSummary summary={summary} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ManifestCard({ expired, manifest }: Readonly<{ expired: boolean; manifest: IrdoseShareManifest }>) {
  return (
    <section className="demo-irdose-card">
      <strong>{manifest.study.isotope} / Study {manifest.study.id}</strong>
      <span>Patient ID: {manifest.patient.patient_id}</span>
      <span>Status: {manifest.study.status} / {manifest.study.cum_method}</span>
      <span>Expires: {manifest.expires_at}{expired ? " (expired)" : ""}</span>
    </section>
  );
}

function PackageSummary({ summary }: Readonly<{ summary: IrdosePackageSummary }>) {
  return (
    <section className="demo-irdose-summary">
      <h3>Unpacked package</h3>
      <dl>
        <dt>CT files</dt>
        <dd>{summary.ctFiles}</dd>
        <dt>Activity maps</dt>
        <dd>{summary.activityMaps.map((item) => `${item.name}: ${item.files}`).join(", ") || "0"}</dd>
        <dt>Targets</dt>
        <dd>{summary.targets.map((item) => `${item.name}: ${item.files}`).join(", ") || "0"}</dd>
        <dt>Dose maps</dt>
        <dd>{summary.doseMaps.map((item) => `${item.emission}: ${item.files}`).join(", ") || "0"}</dd>
      </dl>
    </section>
  );
}

async function downloadAndUnpack(
  manifest: IrdoseShareManifest | undefined,
  abortRef: MutableValueRef<AbortController | null>,
  { setDownloadState, setSummary, setError }: IrdoseStateSetters,
): Promise<void> {
  if (!manifest) {
    return;
  }
  const abortController = new AbortController();
  abortRef.current = abortController;
  setDownloadState("downloading");
  setError(undefined);
  setSummary(undefined);
  try {
    const downloaded = await downloadIrdoseStudyPackage(manifest, { signal: abortController.signal });
    const unpacked = await unpackIrdoseStudyPackage(manifest, downloaded.data);
    setSummary(summarizePackage(unpacked));
    setDownloadState("done");
  } catch (error) {
    setError(abortController.signal.aborted ? "IRDose package download cancelled." : errorMessage(error));
    setDownloadState("failed");
  } finally {
    if (abortRef.current === abortController) {
      abortRef.current = null;
    }
  }
}

function loadPastedManifest(
  manifestText: string,
  { setManifest, setSummary, setDownloadState, setError }: IrdoseStateSetters,
): void {
  try {
    setManifest(parseIrdoseShareManifest(manifestText));
    setSummary(undefined);
    setDownloadState("idle");
    setError(undefined);
  } catch (error) {
    setError(errorMessage(error));
  }
}

async function loadManifestFromUrl(
  manifestUrl: string,
  signal: AbortSignal,
  { setManifest, setSummary, setDownloadState, setError }: IrdoseStateSetters,
): Promise<void> {
  try {
    const response = await fetch(manifestUrl, { signal });
    if (!response.ok) {
      throw new Error(`IRDose manifest request failed with HTTP ${response.status}.`);
    }
    setManifest(parseIrdoseShareManifest(await response.json()));
    setSummary(undefined);
    setDownloadState("idle");
    setError(undefined);
  } catch (error) {
    if (!signal.aborted) {
      setError(errorMessage(error));
    }
  }
}

function summarizePackage(unpacked: IrdoseUnpackedStudyPackage): IrdosePackageSummary {
  return {
    ctFiles: unpacked.ctReference.files.length,
    activityMaps: unpacked.activityMaps.map((item) => ({ name: item.name, files: item.files.length })),
    targets: unpacked.targets.map((item) => ({ name: item.name, files: item.files.length })),
    doseMaps: unpacked.doseMaps.map((item) => ({ emission: item.emission, files: item.files.length })),
  };
}

function manifestLabel(manifest: IrdoseShareManifest, expired: boolean): string {
  return `Manifest received: study ${manifest.study.id}, ${manifest.study.isotope}${expired ? ", expired" : ""}.`;
}

function irdosePanelLabel({ manifest, expired, manifestUrl }: { manifest: IrdoseShareManifest | undefined; expired: boolean; manifestUrl: string }): string {
  return manifest ? manifestLabel(manifest, expired) : waitingLabel(manifestUrl);
}

function downloadStateLabel(downloadState: DownloadState): string {
  return downloadState === "downloading" ? "Downloading..." : "Download package";
}

function waitingLabel(manifestUrl: string): string {
  return manifestUrl ? "Loading manifest from signed URL." : "Waiting for postMessage handoff.";
}

function defaultAllowedOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("irdoseAllowedOrigin") || window.location.origin;
}

function defaultManifestUrl(): string {
  return typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("irdoseManifestUrl") || "";
}

function hasIrdoseAllowedOriginParam(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const search = new URLSearchParams(window.location.search);
  return search.has("irdoseAllowedOrigin") || search.has("irdoseManifestUrl");
}

function notifyIrdoseOpener(origin: string, type: string): void {
  if (typeof window === "undefined" || !window.opener || !origin) {
    return;
  }
  window.opener.postMessage({ type }, origin);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function IrdoseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z" /><path d="M12 4v16" /><path d="M4 12h16" /><path d="m8 8 8 8" /><path d="m16 8-8 8" /></svg>;
}
