import type { ClinicalStudy, ViewerControlPlaneSnapshot } from "@pycom-next/core";
import type { PythonAgentDescriptor } from "@pycom-next/pyodide-agents";
import type { ClinicalViewportAssetResolver, ClinicalViewportRendererHandle, ClinicalViewportTemporaryOverlay, ViewerCustomPanel, ViewerCustomPanelPresentation } from "@pycom-next/react-viewer";
import { doseAgentInputForStudy } from "./doseAgentInput";
import { PythonAgentsPanel } from "./PythonAgentsPanel";
import { pyScriptEditorInput } from "./pyscriptEditorInput";

interface DemoAgentsPanelOptions {
  assetResolver: ClinicalViewportAssetResolver;
  bundledBaseUrl: string;
  presentation: ViewerCustomPanelPresentation;
  snapshot: ViewerControlPlaneSnapshot | undefined;
  study: ClinicalStudy;
  viewportHandle: ClinicalViewportRendererHandle | undefined;
  onPresentationChange(presentation: ViewerCustomPanelPresentation): void;
}

export function demoAgentsPanel(options: DemoAgentsPanelOptions): ViewerCustomPanel {
  return {
    key: "agents",
    label: "Agents",
    presentation: options.presentation,
    wide: true,
    icon: <AgentsIcon />,
    content: (
      <PythonAgentsPanel
        bundledBaseUrl={options.bundledBaseUrl}
        createAgentInput={(agent) => inputForAgent(agent, options)}
        createEditorInput={(includeDose) => editorInput(includeDose, options)}
        presentation={options.presentation}
        setTemporaryOverlay={(overlay) => setTemporaryOverlay(overlay, options.viewportHandle)}
        snapshot={options.snapshot}
        onPresentationChange={options.onPresentationChange}
      />
    ),
  };
}

function editorInput(includeDose: boolean, options: DemoAgentsPanelOptions) {
  if (!options.snapshot) {
    return Promise.reject(new Error("Viewer snapshot is not ready yet."));
  }
  return pyScriptEditorInput({ ...options, includeDose, snapshot: options.snapshot });
}

async function setTemporaryOverlay(overlay: ClinicalViewportTemporaryOverlay | undefined, handle: ClinicalViewportRendererHandle | undefined): Promise<boolean> {
  return Boolean(await handle?.setTemporaryOverlay?.(overlay));
}

function inputForAgent(agent: PythonAgentDescriptor, options: DemoAgentsPanelOptions): Promise<unknown> {
  if (!agent.capabilities?.includes("dose-volume")) {
    return Promise.resolve({ source: "edgepy-viewer" });
  }
  const visibleDoseUids = options.snapshot?.visibleLayers.filter((layer) => layer.kind === "dose").map((layer) => layer.uid) ?? [];
  return doseAgentInputForStudy(options.study, options.assetResolver, visibleDoseUids);
}

function AgentsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 8h8v8H8Z" />
      <path d="M9 4h6" />
      <path d="M9 20h6" />
      <path d="M4 9h4" />
      <path d="M16 9h4" />
      <path d="M4 15h4" />
      <path d="M16 15h4" />
    </svg>
  );
}
