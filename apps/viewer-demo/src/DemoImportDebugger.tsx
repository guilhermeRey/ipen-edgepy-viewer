import type { ImportDebugEntry } from "./importDebug";

interface DemoImportDebuggerProps {
  entries: readonly ImportDebugEntry[];
  onClear(): void;
}

export function DemoImportDebugger({ entries, onClear }: Readonly<DemoImportDebuggerProps>) {
  return (
    <details className="demo-import-debug" open={entries.length > 0}>
      <summary>
        Import debugger
        <span>{entries.length} events</span>
      </summary>
      <div className="demo-import-debug-actions">
        <button type="button" disabled={entries.length === 0} onClick={onClear}>Clear</button>
      </div>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <header><time>{entry.time}</time><strong>{entry.phase}</strong><span>{entry.message}</span></header>
            {entry.details ? <pre>{entry.details}</pre> : null}
          </li>
        ))}
      </ol>
    </details>
  );
}
