export interface WorkerClientRequestOptions<Progress> {
  onProgress?: (progress: Progress) => void;
}

export interface WorkerClient<Request, Response, Progress = never> {
  request(request: Request, options?: WorkerClientRequestOptions<Progress>): Promise<Response>;
  dispose(): void;
}

export interface WorkerHandlerContext<Progress> {
  progress(progress: Progress): void;
}

export type WorkerHandler<Request, Response, Progress> = (
  request: Request,
  context: WorkerHandlerContext<Progress>,
) => Promise<Response> | Response;

type WorkerRequestEnvelope<Request> = {
  id: number;
  type: "request";
  payload: Request;
};

type WorkerResponseEnvelope<Response, Progress> =
  | { id: number; type: "response"; payload: Response }
  | { id: number; type: "progress"; payload: Progress }
  | { id: number; type: "error"; error: SerializedWorkerError };

interface WorkerEndpointScope {
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
}

export interface SerializedWorkerError {
  name: string;
  message: string;
  stack?: string;
}

interface PendingRequest<Response, Progress> {
  resolve(response: Response): void;
  reject(error: Error): void;
  onProgress?: (progress: Progress) => void;
}

export function createWorkerClient<Request, Response, Progress = never>(
  workerFactory: () => Worker,
): WorkerClient<Request, Response, Progress> {
  const worker = workerFactory();
  const pending = new Map<number, PendingRequest<Response, Progress>>();
  let nextId = 1;

  worker.addEventListener("message", (event: MessageEvent<WorkerResponseEnvelope<Response, Progress>>) => {
    const message = event.data;
    const request = pending.get(message.id);
    if (!request) {
      return;
    }

    if (message.type === "progress") {
      request.onProgress?.(message.payload);
      return;
    }

    pending.delete(message.id);
    if (message.type === "response") {
      request.resolve(message.payload);
      return;
    }

    request.reject(errorFromSerialized(message.error));
  });

  worker.addEventListener("error", (event) => {
    const error = new Error(event.message || "Worker failed.");
    for (const request of pending.values()) {
      request.reject(error);
    }
    pending.clear();
  });

  return {
    request(payload, options) {
      const id = nextId;
      nextId += 1;

      return new Promise<Response>((resolve, reject) => {
        pending.set(id, { resolve, reject, ...(options?.onProgress ? { onProgress: options.onProgress } : {}) });
        worker.postMessage({ id, type: "request", payload } satisfies WorkerRequestEnvelope<Request>);
      });
    },
    dispose() {
      for (const request of pending.values()) {
        request.reject(new Error("Worker client disposed."));
      }
      pending.clear();
      worker.terminate();
    },
  };
}

export function exposeWorkerHandler<Request, Response, Progress = never>(
  scope: WorkerEndpointScope,
  handler: WorkerHandler<Request, Response, Progress>,
): void {
  scope.addEventListener("message", (event: MessageEvent<WorkerRequestEnvelope<Request>>) => {
    const message = event.data;
    if (message.type !== "request") {
      return;
    }

    const progress = (payload: Progress) => {
      scope.postMessage({ id: message.id, type: "progress", payload } satisfies WorkerResponseEnvelope<Response, Progress>);
    };

    void Promise.resolve()
      .then(() => handler(message.payload, { progress }))
      .then((payload) => {
        scope.postMessage({ id: message.id, type: "response", payload } satisfies WorkerResponseEnvelope<Response, Progress>);
      })
      .catch((error: unknown) => {
        scope.postMessage({ id: message.id, type: "error", error: serializeError(error) } satisfies WorkerResponseEnvelope<Response, Progress>);
      });
  });
}

function serializeError(error: unknown): SerializedWorkerError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  return { name: "Error", message: String(error) };
}

function errorFromSerialized(error: SerializedWorkerError): Error {
  const result = new Error(error.message);
  result.name = error.name;
  if (error.stack) {
    result.stack = error.stack;
  }
  return result;
}
