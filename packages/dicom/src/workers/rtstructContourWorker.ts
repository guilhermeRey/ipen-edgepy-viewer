import { exposeWorkerHandler } from "@pycom-next/worker-runtime";
import { readRtstructContourMetadata } from "../adapters/rtstructContourReader";
import type { RtstructContourWorkerRequest } from "./rtstructContourWorkerClient";
import type { RtstructMetadata } from "../metadata";

exposeWorkerHandler<RtstructContourWorkerRequest, RtstructMetadata | undefined>(
  self,
  (request) => readRtstructContourMetadata(request.data),
);
