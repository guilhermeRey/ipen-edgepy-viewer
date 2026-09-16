export function PythonAgentResult({ output }: Readonly<{ output: unknown }>) {
  const envelope = recordValue(output);
  const result = envelope?.result ?? output;
  const warnings = stringArray(envelope?.warnings);
  return (
    <section className="demo-python-agent-result">
      <h4>Result</h4>
      {isRecord(result) ? (
        <dl>{Object.entries(result).map(([key, value]) => <ResultField key={key} name={key} value={value} />)}</dl>
      ) : <p>{displayValue(result)}</p>}
      {warnings.length > 0 ? <ul className="demo-python-agent-result-warnings">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
      <details>
        <summary>Raw output</summary>
        <pre>{JSON.stringify(output, null, 2)}</pre>
      </details>
    </section>
  );
}

export function pythonAgentResultError(output: unknown): string | undefined {
  const envelope = recordValue(output);
  if (envelope?.status !== "error") {
    return undefined;
  }
  const result = recordValue(envelope.result);
  return typeof result?.message === "string" ? result.message : "The Python agent reported an error.";
}

function ResultField({ name, value }: Readonly<{ name: string; value: unknown }>) {
  return <><dt>{resultLabel(name)}</dt><dd>{displayValue(value)}</dd></>;
}

function resultLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (first) => first.toUpperCase());
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item !== "object") ? value.join(" × ") : JSON.stringify(value);
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value === undefined || value === null ? "—" : String(value);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
