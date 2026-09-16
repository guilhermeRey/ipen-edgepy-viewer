import { describe, expect, it } from "vitest";
import { viewerConfigFromGlobals } from "./viewerConfig";

describe("viewerConfigFromGlobals", () => {
  it("shows local agents by default", () => {
    expect(viewerConfigFromGlobals(undefined, undefined)).toMatchObject({
      localAgents: true,
      pythonAgentsBaseUrl: "agents/",
    });
  });

  it("lets the host hide agents and configure their base URL", () => {
    expect(viewerConfigFromGlobals(undefined, {
      features: { localAgents: false },
      pythonAgents: { bundledBaseUrl: "/static/clinical-viewer/agents/" },
    })).toMatchObject({
      localAgents: false,
      pythonAgentsBaseUrl: "/static/clinical-viewer/agents/",
    });
  });
});
