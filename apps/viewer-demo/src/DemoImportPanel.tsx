import type { ChangeEvent } from "react";

interface DemoImportPanelProps {
  debuggerOpen: boolean;
  hostManifestUrl?: string | undefined;
  isImporting: boolean;
  open: boolean;
  status: string;
  onCancel(): void;
  onDebugOpenChange(open: boolean): void;
  onDirectoryPicker(): void;
  onFileInput(files: FileList | null): void;
  onManifestReload?: ((manifestUrl: string) => void) | undefined;
  onOpenChange(open: boolean): void;
}

export function DemoImportPanel({
  debuggerOpen,
  hostManifestUrl,
  isImporting,
  open,
  status,
  onCancel,
  onDebugOpenChange,
  onDirectoryPicker,
  onFileInput,
  onManifestReload,
  onOpenChange,
}: Readonly<DemoImportPanelProps>) {
  return (
    <div className="demo-import-panel" data-open={open ? "true" : "false"}>
      <button type="button" className="demo-import-panel-toggle" aria-expanded={open} onClick={() => onOpenChange(!open)}>
        <DemoIcon name="import" />
        <span>Import</span>
      </button>
      {open ? (
        <div className="demo-import-panel-body" role="menu" aria-label="Structured import menu">
          <section className="demo-import-panel-section">
            <h3>Local import</h3>
            <p className="demo-import-panel-copy">Open DICOM files or a DICOM folder from this computer. This replaces the current study.</p>
            <p>{status}</p>
            <div className="demo-import-panel-actions">
              <label className="demo-import-panel-action" aria-disabled={isImporting} data-disabled={isImporting ? "true" : "false"}>
                <input className="demo-import-panel-file-input" type="file" multiple {...folderInputAttributes} disabled={isImporting} onChange={(event) => handleFileInputChange(event, onFileInput)} />
                <DemoIcon name="folder" />
                <span><strong>Folder</strong><small>Recommended for CT, SPECT, masks and RTSTRUCT.</small></span>
              </label>
              <label className="demo-import-panel-action" aria-disabled={isImporting} data-disabled={isImporting ? "true" : "false"}>
                <input className="demo-import-panel-file-input" type="file" multiple disabled={isImporting} onChange={(event) => handleFileInputChange(event, onFileInput)} />
                <DemoIcon name="files" />
                <span><strong>Files</strong><small>Select one or more DICOM/ZIP files.</small></span>
              </label>
            </div>
          </section>
          <section className="demo-import-panel-section">
            <h3>Fallbacks</h3>
            <div className="demo-import-panel-actions demo-import-panel-compact-actions">
              <button type="button" disabled={isImporting} onClick={onDirectoryPicker}>Native Folder Picker</button>
              <button type="button" disabled={!isImporting} onClick={onCancel}>Cancel import</button>
            </div>
          </section>
          <section className="demo-import-panel-section">
            <h3>Diagnostics</h3>
            <p className="demo-import-panel-copy">Open the event log only when debugging imports.</p>
            <button type="button" onClick={() => onDebugOpenChange(!debuggerOpen)}>{debuggerOpen ? "Hide import debugger" : "Show import debugger"}</button>
          </section>
          {hostManifestUrl ? (
            <section className="demo-import-panel-section">
              <h3>Host manifest</h3>
              <p className="demo-import-panel-copy">Reload the configured manifest without leaving the viewer.</p>
              <button type="button" disabled={isImporting || !onManifestReload} onClick={() => onManifestReload?.(hostManifestUrl)}>Reload manifest</button>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const folderInputAttributes = { webkitdirectory: "" };

function handleFileInputChange(event: ChangeEvent<HTMLInputElement>, onFileInput: (files: FileList | null) => void) {
  onFileInput(event.currentTarget.files);
  event.currentTarget.value = "";
}

function DemoIcon({ name }: Readonly<{ name: "files" | "folder" | "import" }>) {
  if (name === "folder") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3Z" /><path d="M3 7V5h8l2 2" /></svg>;
  }
  if (name === "files") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7Z" /><path d="M15 3v5h5" /><path d="M4 7v14" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></svg>;
}
