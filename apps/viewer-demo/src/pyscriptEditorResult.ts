import type { ClinicalViewportTemporaryOverlay } from "@pycom-next/react-viewer";

export function temporaryOverlayFromPyScriptResult(output: unknown): ClinicalViewportTemporaryOverlay | undefined {
  if (!isRecord(output) || !isRecord(output.overlay)) {
    return undefined;
  }
  const overlay = output.overlay;
  const width = positiveInteger(overlay.width);
  const height = positiveInteger(overlay.height);
  const sliceIndex = nonNegativeInteger(overlay.sliceIndex);
  const values = overlayValues(overlay.values);
  const shape = { width, height, sliceIndex, values };
  if (!validOverlayShape(shape)) {
    throw new Error("PyScript overlay must provide width, height, sliceIndex and one value per pixel.");
  }
  return {
    id: nonEmptyString(overlay.id) ?? "pyscript-overlay",
    label: nonEmptyString(overlay.label) ?? "PyScript overlay",
    width: shape.width,
    height: shape.height,
    sliceIndex: shape.sliceIndex,
    values: shape.values,
    ...(nonEmptyString(overlay.color) ? { color: nonEmptyString(overlay.color) } : {}),
    ...(typeof overlay.opacity === "number" ? { opacity: overlay.opacity } : {}),
  };
}

export function displayPyScriptResult(output: unknown): unknown {
  if (!isRecord(output) || !isRecord(output.overlay) || output.overlay.values === undefined) {
    return output;
  }
  const values = output.overlay.values;
  const valueCount = numericArrayLength(values);
  const overlay = { ...output.overlay };
  delete overlay.values;
  return { ...output, overlay: { ...overlay, ...(valueCount !== undefined ? { valueCount } : {}) } };
}

function overlayValues(value: unknown): Float32Array | undefined {
  if (value instanceof Float32Array) {
    return value;
  }
  if (numericArrayLength(value) === undefined) {
    return undefined;
  }
  return Float32Array.from(value as ArrayLike<number>, (item) => Number(item));
}

interface OptionalOverlayShape {
  width: number | undefined;
  height: number | undefined;
  sliceIndex: number | undefined;
  values: Float32Array | undefined;
}

function validOverlayShape(shape: OptionalOverlayShape): shape is { width: number; height: number; sliceIndex: number; values: Float32Array } {
  return shape.width !== undefined && shape.height !== undefined && shape.sliceIndex !== undefined && shape.values !== undefined && shape.values.length === shape.width * shape.height;
}

function numericArrayLength(value: unknown): number | undefined {
  if (Array.isArray(value)) {
    return value.length;
  }
  const length = ArrayBuffer.isView(value) ? (value as unknown as { length?: unknown }).length : undefined;
  return typeof length === "number" ? length : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
