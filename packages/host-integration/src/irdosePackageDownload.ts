interface IrdosePackageDownloadManifest {
  auth: {
    download_endpoint: string;
  };
}

export interface IrdosePackageDownloadOptions {
  fetch?: IrdosePackageFetch;
  signal?: AbortSignal;
}

export interface IrdosePackageDownloadResult {
  data: ArrayBuffer;
  contentType?: string;
  filename?: string;
}

export type IrdosePackageFetch = (
  input: string,
  init?: { method?: "GET"; signal?: AbortSignal | undefined },
) => Promise<IrdosePackageFetchResponse>;

export interface IrdosePackageFetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers?: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}

export class IrdosePackageDownloadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "IrdosePackageDownloadError";
  }
}

export async function downloadIrdoseStudyPackage(
  manifest: IrdosePackageDownloadManifest,
  options: IrdosePackageDownloadOptions = {},
): Promise<IrdosePackageDownloadResult> {
  const fetchPackage = options.fetch ?? browserFetch();
  const response = await fetchPackage(manifest.auth.download_endpoint, { method: "GET", ...(options.signal ? { signal: options.signal } : {}) });
  if (!response.ok) {
    throw new IrdosePackageDownloadError(await responseErrorMessage(response), response.status);
  }
  const contentType = headerValue(response, "content-type");
  const filename = filenameFromContentDisposition(headerValue(response, "content-disposition"));

  return {
    data: await response.arrayBuffer(),
    ...(contentType ? { contentType } : {}),
    ...(filename ? { filename } : {}),
  };
}

export function filenameFromContentDisposition(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const filenamePart = value.split(";").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith("filename="));
  if (!filenamePart) {
    return undefined;
  }
  const filename = filenamePart.slice("filename=".length).replace(/^"|"$/g, "").trim();
  return safeDownloadFilename(filename);
}

function browserFetch(): IrdosePackageFetch {
  if (typeof fetch !== "function") {
    throw new Error("IRDose package download requires fetch or an injected fetch implementation.");
  }
  return fetch as IrdosePackageFetch;
}

function headerValue(response: IrdosePackageFetchResponse, name: string): string | undefined {
  return response.headers?.get(name) ?? undefined;
}

async function responseErrorMessage(response: IrdosePackageFetchResponse): Promise<string> {
  const serverMessage = await responseServerMessage(response);
  if (serverMessage) {
    return serverMessage;
  }
  if (response.status === 403) {
    return "IRDose package token is invalid, expired, or has already been used.";
  }
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  return `IRDose package download failed with HTTP ${response.status}${statusText}.`;
}

async function responseServerMessage(response: IrdosePackageFetchResponse): Promise<string | undefined> {
  if (response.json) {
    try {
      const value = await response.json();
      if (isRecord(value) && typeof value.error === "string") {
        return value.error;
      }
    } catch {
      return undefined;
    }
  }
  if (response.text) {
    try {
      const text = await response.text();
      return text.trim() || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function safeDownloadFilename(value: string): string | undefined {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized || normalized.includes("/") || normalized === "." || normalized === "..") {
    return undefined;
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
