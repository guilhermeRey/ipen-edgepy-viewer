export interface DemoViewerConfig {
  exitUrl?: string;
  localAgents: boolean;
  pythonAgentsBaseUrl: string;
  viewerAssetsUrl?: string;
}

interface ClinicalViewerHostConfig {
  features?: { localAgents?: unknown };
  pythonAgents?: { bundledBaseUrl?: unknown };
  ui?: { exitUrl?: unknown };
}

export function pycomViewerConfig(): DemoViewerConfig {
  if (typeof window === "undefined") {
    return { localAgents: true, pythonAgentsBaseUrl: "agents/" };
  }
  const config = (window as Window & { PYCOM_VIEWER_CONFIG?: { viewerAssetsUrl?: unknown } }).PYCOM_VIEWER_CONFIG;
  const clinicalConfig = (window as Window & { PYCOM_CLINICAL_VIEWER_CONFIG?: ClinicalViewerHostConfig }).PYCOM_CLINICAL_VIEWER_CONFIG;
  return viewerConfigFromGlobals(config, clinicalConfig);
}

export function viewerConfigFromGlobals(
  config: { viewerAssetsUrl?: unknown } | undefined,
  clinicalConfig: ClinicalViewerHostConfig | undefined,
): DemoViewerConfig {
  return {
    localAgents: clinicalConfig?.features?.localAgents !== false,
    pythonAgentsBaseUrl: stringOrDefault(clinicalConfig?.pythonAgents?.bundledBaseUrl, "agents/"),
    ...optionalStringField("exitUrl", clinicalConfig?.ui?.exitUrl),
    ...optionalStringField("viewerAssetsUrl", config?.viewerAssetsUrl),
  };
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function optionalStringField<Key extends string>(key: Key, value: unknown): Partial<Record<Key, string>> {
  return typeof value === "string" && value ? { [key]: value } as Record<Key, string> : {};
}
