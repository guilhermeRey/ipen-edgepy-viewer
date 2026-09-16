import { useRef, useState } from "react";
import { createImportDebugEntry, type ImportDebugEntry, type ImportDebugInput } from "./importDebug";

const MAX_DEBUG_ENTRIES = 40;

export function useImportDebug() {
  const debugIdRef = useRef(0);
  const [debugEntries, setDebugEntries] = useState<ImportDebugEntry[]>([]);

  function recordDebug(input: ImportDebugInput) {
    const entry = createImportDebugEntry(++debugIdRef.current, input);
    setDebugEntries((current) => [entry, ...current].slice(0, MAX_DEBUG_ENTRIES));
    console.debug(`[EdgePy import:${entry.phase}] ${entry.message}`, input.details ?? "");
  }

  function clearDebug() {
    setDebugEntries([]);
  }

  return { clearDebug, debugEntries, recordDebug };
}
