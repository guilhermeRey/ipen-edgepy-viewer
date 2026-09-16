import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import type { ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { PycomClinicalViewerNext, type ClinicalViewportRendererHandle, type ViewerCustomPanelPresentation } from "@pycom-next/react-viewer";
import { demoAgentsPanel } from "./demoAgentsPanel";
import { DemoImportPanel } from "./DemoImportPanel";
import { DemoImportBar } from "./DemoImportBar";
import { useDemoImports } from "./useDemoImports";
import { pycomViewerConfig } from "./viewerConfig";

export function App() {
  const [viewerConfig] = useState(pycomViewerConfig);
  const hostManifestUrl = viewerConfig.viewerAssetsUrl;
  const imports = useDemoImports({ hostManifestUrl });
  const [pendingHostManifestUrl, setPendingHostManifestUrl] = useState<string | undefined>(undefined);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importDebuggerOpen, setImportDebuggerOpen] = useState(() => debugModeFromLocation());
  const [viewerSnapshot, setViewerSnapshot] = useState<ViewerControlPlaneSnapshot | undefined>(undefined);
  const [viewportHandle, setViewportHandle] = useState<ClinicalViewportRendererHandle | undefined>(undefined);
  const [agentsPanelPresentation, setAgentsPanelPresentation] = useState<ViewerCustomPanelPresentation>("side");
  const agentsPanel = demoAgentsPanel({ assetResolver: imports.assetResolver, bundledBaseUrl: viewerConfig.pythonAgentsBaseUrl, presentation: agentsPanelPresentation, snapshot: viewerSnapshot, study: imports.study, viewportHandle, onPresentationChange: setAgentsPanelPresentation });

  useEffect(() => {
    function reloadHostManifest(event: Event) {
      const manifestUrl = hostManifestUrlFromEvent(event) ?? hostManifestUrl;
      if (manifestUrl) {
        if (imports.isImporting) {
          setPendingHostManifestUrl(manifestUrl);
        } else {
          void imports.replaceFromHostManifestUrl(manifestUrl);
        }
      }
    }
    window.addEventListener("edgepy:reload-host-manifest", reloadHostManifest);
    return () => window.removeEventListener("edgepy:reload-host-manifest", reloadHostManifest);
  }, [hostManifestUrl, imports, imports.isImporting]);

  useEffect(() => {
    if (!pendingHostManifestUrl || imports.isImporting) {
      return;
    }
    const manifestUrl = pendingHostManifestUrl;
    setPendingHostManifestUrl(undefined);
    void imports.replaceFromHostManifestUrl(manifestUrl);
  }, [imports, imports.isImporting, pendingHostManifestUrl]);

  return (
    <>
      <DemoImportBar imports={imports} open={importDebuggerOpen} onClose={() => setImportDebuggerOpen(false)} />
      <DemoImportProgress imports={imports} />
      <main className="demo-shell">
        <PycomClinicalViewerNext
          assetResolver={imports.assetResolver}
          customPanels={viewerConfig.localAgents ? [agentsPanel] : []}
          study={imports.study}
          title="EdgePy Viewer"
          viewportRenderer={imports.viewportRenderer}
          onControlPlaneSnapshotChange={setViewerSnapshot}
          onViewportRendererHandleChange={setViewportHandle}
          railActions={(
            <ViewerRailActions
              debugActive={importDebuggerOpen}
              exitUrl={viewerConfig.exitUrl}
              onDebugToggle={() => setImportDebuggerOpen((open) => !open)}
            />
          )}
          toolbarActions={(
            <StructuredImportMenu
              debuggerOpen={importDebuggerOpen}
              imports={imports}
              open={importPanelOpen}
              onDebugOpenChange={setImportDebuggerOpen}
              onOpenChange={setImportPanelOpen}
            />
          )}
          studyPanelActions={<AcquisitionActions imports={imports} />}
          inspectorPanelActions={<OverlayActions activeScanId={viewerSnapshot?.activeScanId} imports={imports} />}
        />
      </main>
    </>
  );
}

function ViewerRailActions({ debugActive, exitUrl, onDebugToggle }: Readonly<{ debugActive: boolean; exitUrl?: string | undefined; onDebugToggle(): void }>) {
  return (
    <>
      <DebugRailButton active={debugActive} onToggle={onDebugToggle} />
      {exitUrl ? <ExitRailLink href={exitUrl} /> : null}
    </>
  );
}

function DebugRailButton({ active, onToggle }: Readonly<{ active: boolean; onToggle(): void }>) {
  return (
    <button type="button" className="pycom-next-rail-button" data-label="Debug" aria-pressed={active} aria-label={`${active ? "Hide" : "Show"} debug`} onClick={onToggle}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8v8H8Z" /><path d="M9 4h6" /><path d="M9 20h6" /><path d="M4 9h4" /><path d="M16 9h4" /><path d="M4 15h4" /><path d="M16 15h4" /><path d="m7 5 2 3" /><path d="m17 5-2 3" /></svg>
      <span>Debug</span>
    </button>
  );
}

function ExitRailLink({ href }: Readonly<{ href: string }>) {
  return (
    <a className="pycom-next-rail-button" data-label="Sair" aria-label="Sair do viewer" href={href}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6H5v12h5" /><path d="M13 8l4 4-4 4" /><path d="M17 12H8" /></svg>
      <span>Sair</span>
    </a>
  );
}

interface StructuredImportMenuProps {
  debuggerOpen: boolean;
  imports: ReturnType<typeof useDemoImports>;
  open: boolean;
  onDebugOpenChange(open: boolean): void;
  onOpenChange(open: boolean): void;
}

function StructuredImportMenu({ debuggerOpen, imports, open, onDebugOpenChange, onOpenChange }: Readonly<StructuredImportMenuProps>) {
  return (
    <DemoImportPanel
      debuggerOpen={debuggerOpen}
      hostManifestUrl={imports.hostManifestUrl}
      isImporting={imports.isImporting}
      open={open}
      status={imports.status}
      onCancel={imports.cancelImport}
      onDebugOpenChange={onDebugOpenChange}
      onDirectoryPicker={() => void imports.importDirectoryWithPicker()}
      onFileInput={(files) => void imports.replaceFromFileList(files)}
      onManifestReload={(manifestUrl) => void imports.replaceFromHostManifestUrl(manifestUrl)}
      onOpenChange={onOpenChange}
    />
  );
}

function DemoImportProgress({ imports }: Readonly<{ imports: ReturnType<typeof useDemoImports> }>) {
  if (!imports.isImporting) {
    return null;
  }

  return (
    <aside className="demo-import-progress" data-importing="true" aria-live="polite" aria-label="Import status">
      <span className="demo-import-progress-indicator" aria-hidden="true" />
      <span><strong>Importing</strong><small>{statusForProgress(imports.status)}</small></span>
      <button type="button" onClick={imports.cancelImport}>Cancel</button>
    </aside>
  );
}

function statusForProgress(status: string) {
  return status.startsWith("Use Local import") ? "Ready for local files, folders or host manifest." : status;
}

function AcquisitionActions({ imports }: Readonly<{ imports: ReturnType<typeof useDemoImports> }>) {
  return (
    <section className="demo-panel-actions" aria-label="Add acquisition">
      <ActionLabel icon="scan" title="Add acquisition" hint="CT + SPECT or CT-only">
        <input type="file" multiple disabled={imports.isImporting} onChange={(event) => handleFileInputChange(event, imports.addAcquisitionFromFileList)} />
      </ActionLabel>
      <ActionLabel icon="folder" title="Acquisition folder" hint="Use a CT/SPECT folder">
        <input ref={imports.acquisitionFolderInputRef} type="file" multiple {...folderInputAttributes} disabled={imports.isImporting} onChange={(event) => handleFileInputChange(event, imports.addAcquisitionFromFileList)} />
      </ActionLabel>
    </section>
  );
}

function OverlayActions({ activeScanId, imports }: Readonly<{ activeScanId?: string | undefined; imports: ReturnType<typeof useDemoImports> }>) {
  const targetScanIds = effectiveOverlayTargetScanIds(imports.mapTargetScanIds, activeScanId);
  return (
    <section className="demo-panel-actions" aria-label="Add overlays">
      <ActionLabel icon="overlay" title="Add overlay" hint="Lesion, organ, dose, RTSTRUCT">
        <input type="file" multiple disabled={imports.isImporting || imports.scanIds.length === 0} onChange={(event) => handleFileInputChange(event, (files) => imports.addMapFromFileList(files, targetScanIds))} />
      </ActionLabel>
      <ActionLabel icon="folder" title="Overlay folder" hint="Apply to selected scans">
        <input ref={imports.mapFolderInputRef} type="file" multiple {...folderInputAttributes} disabled={imports.isImporting || imports.scanIds.length === 0} onChange={(event) => handleFileInputChange(event, (files) => imports.addMapFromFileList(files, targetScanIds))} />
      </ActionLabel>
      <ScanTargetPicker activeScanId={activeScanId} imports={imports} />
    </section>
  );
}

function ScanTargetPicker({ activeScanId, imports }: Readonly<{ activeScanId?: string | undefined; imports: ReturnType<typeof useDemoImports> }>) {
  return (
    <fieldset className="demo-import-targets" disabled={imports.isImporting || imports.scanIds.length === 0}>
      <legend>Apply next overlay to</legend>
      {imports.scanIds.map((scanId) => (
        <label key={scanId}>
          <input type="checkbox" checked={imports.mapTargetScanIds.has(scanId)} onChange={() => imports.toggleMapTarget(scanId)} />
          {scanId}
        </label>
      ))}
      <small>{overlayTargetHint(imports.scanIds.length, imports.mapTargetScanIds, activeScanId)}</small>
    </fieldset>
  );
}

function effectiveOverlayTargetScanIds(selectedScanIds: ReadonlySet<string>, activeScanId: string | undefined): string[] {
  if (selectedScanIds.size > 0) {
    return Array.from(selectedScanIds);
  }
  return activeScanId ? [activeScanId] : [];
}

function overlayTargetHint(scanCount: number, selectedScanIds: ReadonlySet<string>, activeScanId: string | undefined): string {
  if (scanCount === 0) {
    return "Add an acquisition first.";
  }
  if (selectedScanIds.size > 0) {
    return "Selected scans override the active scan.";
  }
  return activeScanId ? `None selected uses active scan ${activeScanId}.` : "None selected means all scans.";
}

function ActionLabel({ children, hint, icon, title }: Readonly<{ children: ReactNode; hint: string; icon: "folder" | "overlay" | "scan"; title: string }>) {
  return (
    <label className="demo-action-card">
      <DemoActionIcon name={icon} />
      <span><strong>{title}</strong><small>{hint}</small></span>
      {children}
    </label>
  );
}

const folderInputAttributes = { webkitdirectory: "" };

function handleFileInputChange(event: ChangeEvent<HTMLInputElement>, onFiles: (files: FileList | null) => Promise<void>) {
  void onFiles(event.currentTarget.files);
  event.currentTarget.value = "";
}

function debugModeFromLocation(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const value = new URLSearchParams(window.location.search).get("debug");
  return value === "1" || value === "true";
}

function hostManifestUrlFromEvent(event: Event): string | undefined {
  const detail = event instanceof CustomEvent && typeof event.detail === "object" && event.detail ? event.detail as { manifestUrl?: unknown } : undefined;
  return typeof detail?.manifestUrl === "string" && detail.manifestUrl ? detail.manifestUrl : undefined;
}

function DemoActionIcon({ name }: Readonly<{ name: "folder" | "overlay" | "scan" }>) {
  if (name === "folder") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3Z" /><path d="M3 7V5h8l2 2" /></svg>;
  }
  if (name === "overlay") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 4 9l8 4 8-4-8-4Z" /><path d="m4 13 8 4 8-4" /><path d="m4 17 8 4 8-4" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5Z" /><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}
