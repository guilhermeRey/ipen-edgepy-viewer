import type { ClinicalStudy, ViewerControlPlaneSnapshot } from "@pycom-next/core";
import type { PyScriptExecutionInput } from "@pycom-next/pyodide-agents";
import type { ClinicalViewportAssetResolver, ClinicalViewportRendererHandle } from "@pycom-next/react-viewer";
import { doseAgentInputForStudy } from "./doseAgentInput";

export async function pyScriptEditorInput(options: {
  assetResolver: ClinicalViewportAssetResolver;
  includeDose: boolean;
  snapshot: ViewerControlPlaneSnapshot;
  study: ClinicalStudy;
  viewportHandle: ClinicalViewportRendererHandle | undefined;
}): Promise<PyScriptExecutionInput> {
  const image = await options.viewportHandle?.getCurrentImageData?.();
  if (!image) {
    throw new Error("The active renderer does not expose a decoded image slice yet.");
  }
  if (!options.includeDose) {
    return { source: "edgepy-viewer", image };
  }
  const visibleDoseUids = options.snapshot.visibleLayers.filter((layer) => layer.kind === "dose").map((layer) => layer.uid);
  const doseInput = await doseAgentInputForStudy(options.study, options.assetResolver, visibleDoseUids);
  if (!doseInput.doseVolume) {
    throw new Error("No readable MHD/RAW dose volume is available for this PyScript execution.");
  }
  return { source: "edgepy-viewer", image, doseVolume: doseInput.doseVolume };
}
