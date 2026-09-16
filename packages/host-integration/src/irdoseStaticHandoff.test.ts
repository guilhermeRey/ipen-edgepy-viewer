import { describe, expect, it, vi } from "vitest";
import {
  createIrdoseShareManifestMessage,
  listenForIrdoseShareManifest,
  type IrdoseMessageEventTarget,
  type IrdoseShareManifest,
} from "./index";

describe("IRDose static handoff", () => {
  it("accepts a share manifest message from an allowed origin", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    const stop = listenForIrdoseShareManifest({
      target,
      allowedOrigins: ["https://irdose.example.com"],
      onManifest,
    });

    target.dispatch("https://irdose.example.com", createIrdoseShareManifestMessage(validIrdoseManifest()));

    expect(onManifest).toHaveBeenCalledWith(
      expect.objectContaining({ schema_version: "1.0" }),
      expect.objectContaining({ origin: "https://irdose.example.com" }),
    );

    stop();
  });

  it("accepts a JSON encoded manifest payload", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    listenForIrdoseShareManifest({
      target,
      allowedOrigins: (origin) => origin === "https://irdose.example.com",
      onManifest,
    });

    target.dispatch("https://irdose.example.com", createIrdoseShareManifestMessage(JSON.stringify(validIrdoseManifest())));

    expect(onManifest).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ token: "00000000-0000-4000-8000-000000000001" }) }),
      expect.anything(),
    );
  });

  it("ignores unrelated message types", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    const onError = vi.fn();
    listenForIrdoseShareManifest({
      target,
      allowedOrigins: ["https://irdose.example.com"],
      onManifest,
      onError,
    });

    target.dispatch("https://irdose.example.com", { type: "other", manifest: validIrdoseManifest() });

    expect(onManifest).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores unrelated messages from disallowed origins", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    const onError = vi.fn();
    listenForIrdoseShareManifest({
      target,
      allowedOrigins: ["https://irdose.example.com"],
      onManifest,
      onError,
    });

    target.dispatch("https://viewer.example.com", { type: "vite:ping" });

    expect(onManifest).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects messages from disallowed origins", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    const onError = vi.fn();
    listenForIrdoseShareManifest({
      target,
      allowedOrigins: ["https://irdose.example.com"],
      onManifest,
      onError,
    });

    target.dispatch("https://attacker.example.com", createIrdoseShareManifestMessage(validIrdoseManifest()));

    expect(onManifest).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Rejected IRDose share manifest from origin: https://attacker.example.com" }),
      expect.objectContaining({ origin: "https://attacker.example.com" }),
    );
  });

  it("removes the listener when stopped", () => {
    const target = createMessageTarget();
    const onManifest = vi.fn();
    const stop = listenForIrdoseShareManifest({
      target,
      allowedOrigins: ["https://irdose.example.com"],
      onManifest,
    });

    stop();
    target.dispatch("https://irdose.example.com", createIrdoseShareManifestMessage(validIrdoseManifest()));

    expect(onManifest).not.toHaveBeenCalled();
  });
});

function createMessageTarget(): IrdoseMessageEventTarget & { dispatch(origin: string, data: unknown): void } {
  const listeners = new Set<(event: MessageEvent) => void>();
  return {
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    dispatch(origin, data) {
      for (const listener of listeners) {
        listener({ origin, data } as MessageEvent);
      }
    },
  };
}

function validIrdoseManifest(): IrdoseShareManifest {
  return {
    schema_version: "1.0",
    generated_at: "2025-06-03T14:00:00.000000+00:00",
    expires_at: "2025-06-05T14:00:00.000000+00:00",
    single_use: true,
    auth: {
      token: "00000000-0000-4000-8000-000000000001",
      download_endpoint: "https://irdose.example.com/dosimetry/api/study-package/00000000-0000-4000-8000-000000000001/",
    },
    study: {
      id: 42,
      owner: "synthetic-user",
      created_at: "2025-06-01T10:30:00+00:00",
      isotope: "Lu-177",
      emission_type: "beta-",
      cum_method: "map",
      status: "DONE",
    },
    patient: {
      patient_id: "SYNTHETIC-PATIENT-001",
    },
    files: {
      ct_reference: {
        ct_name: "CT_baseline",
        filename: "ct_reference.zip",
      },
      activity_maps: [],
      targets: [],
      dose_maps: [],
    },
  };
}
