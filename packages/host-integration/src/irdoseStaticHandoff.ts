import { parseIrdoseShareManifest, type IrdoseShareManifest } from "./irdoseShareManifest";

export const IRDOSE_SHARE_MANIFEST_MESSAGE_TYPE = "irdose-share-manifest";

export interface IrdoseShareManifestMessage {
  type: typeof IRDOSE_SHARE_MANIFEST_MESSAGE_TYPE;
  manifest: IrdoseShareManifest | string;
}

export interface IrdoseStaticHandoffOptions {
  allowedOrigins: readonly string[] | ((origin: string) => boolean);
  onManifest(manifest: IrdoseShareManifest, event: MessageEvent<IrdoseShareManifestMessage>): void;
  onError?(error: Error, event: MessageEvent): void;
  target?: IrdoseMessageEventTarget;
}

export interface IrdoseMessageEventTarget {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
}

export function listenForIrdoseShareManifest(options: IrdoseStaticHandoffOptions): () => void {
  const target = options.target ?? browserMessageTarget();
  const onMessage = (event: MessageEvent) => {
    if (!isIrdoseShareManifestMessage(event.data)) {
      return;
    }

    if (!isAllowedOrigin(event.origin, options.allowedOrigins)) {
      options.onError?.(new Error(`Rejected IRDose share manifest from origin: ${event.origin}`), event);
      return;
    }

    try {
      options.onManifest(parseIrdoseShareManifest(event.data.manifest), event as MessageEvent<IrdoseShareManifestMessage>);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)), event);
    }
  };

  target.addEventListener("message", onMessage);
  return () => target.removeEventListener("message", onMessage);
}

export function createIrdoseShareManifestMessage(manifest: IrdoseShareManifest | string): IrdoseShareManifestMessage {
  return { type: IRDOSE_SHARE_MANIFEST_MESSAGE_TYPE, manifest };
}

function isAllowedOrigin(origin: string, allowedOrigins: IrdoseStaticHandoffOptions["allowedOrigins"]): boolean {
  return typeof allowedOrigins === "function" ? allowedOrigins(origin) : allowedOrigins.includes(origin);
}

function isIrdoseShareManifestMessage(value: unknown): value is IrdoseShareManifestMessage {
  return typeof value === "object"
    && value !== null
    && (value as { type?: unknown }).type === IRDOSE_SHARE_MANIFEST_MESSAGE_TYPE
    && (typeof (value as { manifest?: unknown }).manifest === "string" || typeof (value as { manifest?: unknown }).manifest === "object");
}

function browserMessageTarget(): IrdoseMessageEventTarget {
  if (typeof window === "undefined") {
    throw new Error("IRDose static handoff requires a browser message target.");
  }
  return window;
}
