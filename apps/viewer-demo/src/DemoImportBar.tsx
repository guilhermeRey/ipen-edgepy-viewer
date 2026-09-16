import type { useDemoImports } from "./useDemoImports";
import { DemoImportDebugger } from "./DemoImportDebugger";

interface DemoImportBarProps {
  open: boolean;
  imports: ReturnType<typeof useDemoImports>;
  onClose(): void;
}

export function DemoImportBar({ imports, onClose, open }: Readonly<DemoImportBarProps>) {
  if (!open) {
    return null;
  }

  return (
    <section className="demo-import-bar" aria-label="Local import debugger">
      <div className="demo-import-bar-status">
        <strong>Local import debugger</strong>
        <span>{imports.hostManifestUrl ? `${imports.status} Manifest: ${imports.hostManifestUrl}` : imports.status}</span>
      </div>
      <div className="demo-import-bar-actions">
        <button type="button" onClick={onClose}>Close debugger</button>
      </div>
      <DemoImportDebugger entries={imports.debugEntries} onClear={imports.clearDebug} />
    </section>
  );
}
