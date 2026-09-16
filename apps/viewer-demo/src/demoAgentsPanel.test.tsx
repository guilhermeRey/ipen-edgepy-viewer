import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { ClinicalStudy, ViewerControlPlaneSnapshot } from "@pycom-next/core";
import { demoAgentsPanel } from "./demoAgentsPanel";

describe("demoAgentsPanel", () => {
  it("creates the clickable Agents workspace with the current snapshot", async () => {
    const study: ClinicalStudy = { uid: "study-1", label: "Study 1", scans: [], series: [], overlays: [] };
    const snapshot: ViewerControlPlaneSnapshot = {
      controlPlaneVersion: 1,
      study,
      visibleLayers: [],
      fusionContext: { status: "empty", overlayUids: [] },
    };
    const presentationChanges: string[] = [];
    const panel = demoAgentsPanel({ assetResolver: { resolveSeriesAssets: () => [], resolveOverlayAssets: () => [] }, bundledBaseUrl: "/agents/", presentation: "bottom", snapshot, study, viewportHandle: undefined, onPresentationChange: (presentation) => presentationChanges.push(presentation) });

    expect(panel.key).toBe("agents");
    expect(panel.label).toBe("Agents");
    expect(panel.presentation).toBe("bottom");
    expect(panel.wide).toBe(true);
    expect(isValidElement(panel.content)).toBe(true);

    const content = panel.content as ReactElement<{
      bundledBaseUrl: string;
      createAgentInput(agent: { capabilities?: string[] }): Promise<unknown>;
      createEditorInput(includeDose: boolean): Promise<unknown>;
      presentation: string;
      snapshot: ViewerControlPlaneSnapshot;
      onPresentationChange(presentation: "side"): void;
    }>;
    expect(content.props.bundledBaseUrl).toBe("/agents/");
    expect(content.props.snapshot).toBe(snapshot);
    expect(content.props.presentation).toBe("bottom");
    content.props.onPresentationChange("side");
    expect(presentationChanges).toEqual(["side"]);
    await expect(content.props.createAgentInput({ capabilities: [] })).resolves.toEqual({ source: "edgepy-viewer" });
    await expect(content.props.createAgentInput({ capabilities: ["dose-volume"] })).resolves.toEqual({});
    await expect(content.props.createEditorInput(false)).rejects.toThrow("decoded image slice");
  });
});
