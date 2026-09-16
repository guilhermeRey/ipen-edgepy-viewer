import type { ClinicalStudy } from "@pycom-next/core";

export * from "./pythonAgentLoader";
export * from "./pyscriptRuntime";
export * from "./pyscriptTypes";
export * from "./pythonWorkerProtocol";
export * from "./pythonWorkerRuntime";

export interface AgentDescriptor {
  name: string;
  version: string;
  description?: string;
}

export interface AgentRunRequest {
  agentName: string;
  study: ClinicalStudy;
  input?: unknown;
}

export interface AgentRunResult {
  agentName: string;
  status: "completed" | "failed";
  output?: unknown;
  error?: string;
}

export interface AgentRuntime {
  listAgents(): Promise<AgentDescriptor[]>;
  runAgent(request: AgentRunRequest): Promise<AgentRunResult>;
}
