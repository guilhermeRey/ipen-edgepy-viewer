import type { Dispatch, SetStateAction } from "react";
import { assembleClinicalStudy, type ClinicalStudy } from "@pycom-next/core";
import { createClinicalStudyInputFromDicomInventory, type DicomInventoryResult, type DicomInventoryWorkerClient } from "@pycom-next/dicom";
import type { ClinicalViewportAssetResolver, ClinicalViewportRenderer } from "@pycom-next/react-viewer";
import { createCornerstoneStackRenderer } from "@pycom-next/renderer-cornerstone";
import { createDemoAssetResolver } from "./demoAssetResolver";
import { assetByPathFromFiles, errorMessage, inventoryFromLocalFiles, mergeAssetMaps } from "./demoInventoryImport";
import { localImportFilesFromHostManifestUrl } from "./hostManifestImport";
import { summarizeFileList, summarizeLocalImportFiles, type ImportDebugInput } from "./importDebug";
import { filesFromFileList, pickDirectoryFiles, type LocalImportFile } from "./localImportFiles";
import { addAcquisitionToBuilder, addMapToBuilder, buildDemoClinicalStudy, createDemoStudyBuilderFromStudy, scanIdsFromBuilder, type DemoStudyBuilderState } from "./studyBuilder";

const cornerstoneStackRenderer = createCornerstoneStackRenderer();

interface MutableValueRef<T> {
  current: T;
}

export interface DemoImportActions {
  addAcquisitionFromFileList(fileList: FileList | null): Promise<void>;
  addMapFromFileList(fileList: FileList | null, targetScanIds?: readonly string[]): Promise<void>;
  cancelImport(): void;
  importDirectoryWithPicker(): Promise<void>;
  replaceFromFileList(fileList: FileList | null): Promise<void>;
  replaceFromHostManifestUrl(manifestUrl: string): Promise<void>;
  toggleMapTarget(scanId: string): void;
}

export interface DemoImportActionContext {
  assetByPathRef: MutableValueRef<ReadonlyMap<string, Blob>>;
  builder: DemoStudyBuilderState;
  importAbortRef: MutableValueRef<AbortController | null>;
  mapTargetScanIds: ReadonlySet<string>;
  recordDebug(input: ImportDebugInput): void;
  setAssetResolver: Dispatch<SetStateAction<ClinicalViewportAssetResolver>>;
  setBuilder: Dispatch<SetStateAction<DemoStudyBuilderState>>;
  setIsImporting: Dispatch<SetStateAction<boolean>>;
  setMapTargetScanIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setStudy: Dispatch<SetStateAction<ClinicalStudy>>;
  setViewportRenderer: Dispatch<SetStateAction<ClinicalViewportRenderer | undefined>>;
  status: string;
  workerClientRef: MutableValueRef<DicomInventoryWorkerClient | null>;
}

interface BuilderImportOptions {
  files: readonly LocalImportFile[];
  label: string;
  applyInventory(inventory: DicomInventoryResult): void;
}

interface ReplacementStudyOptions {
  files: readonly LocalImportFile[];
  abortController: AbortController;
  studyOptions: { uid: string; label: string };
}

interface FileImportOptions {
  files: readonly LocalImportFile[];
  label: string;
  action(abortController: AbortController): Promise<void>;
}

export function createDemoImportActions(ctx: DemoImportActionContext): DemoImportActions {
  return {
    async replaceFromFileList(fileList) {
      ctx.recordDebug({ phase: "file-input", message: "Replace study file input changed.", details: summarizeFileList(fileList) });
      const files = await prepareFileListImport(ctx, fileList, "study");
      if (!files) return;
      ctx.recordDebug({ phase: "local-files", message: "Replace study files expanded.", details: summarizeLocalImportFiles(files) });
      await importReplacement(ctx, files);
    },
    async addAcquisitionFromFileList(fileList) {
      ctx.recordDebug({ phase: "file-input", message: "Add acquisition file input changed.", details: summarizeFileList(fileList) });
      const files = await prepareFileListImport(ctx, fileList, "acquisition");
      if (!files) return;
      ctx.recordDebug({ phase: "local-files", message: "Acquisition files expanded.", details: summarizeLocalImportFiles(files) });
      await importBuilderFiles(ctx, { files, label: "acquisition", applyInventory(inventory) {
        const nextBuilder = addAcquisitionToBuilder(ctx.builder, inventory);
        setBuilderStudy(ctx, nextBuilder);
        ctx.setMapTargetScanIds(new Set(scanIdsFromBuilder(nextBuilder)));
        ctx.setStatus(`Added acquisition ${scanIdsFromBuilder(nextBuilder).at(-1) ?? "scan"}.`);
      } });
    },
    async addMapFromFileList(fileList, targetScanIds) {
      ctx.recordDebug({ phase: "file-input", message: "Add overlay file input changed.", details: summarizeFileList(fileList) });
      const files = await prepareFileListImport(ctx, fileList, "overlay");
      if (!files) return;
      const effectiveTargetScanIds = targetScanIds ?? Array.from(ctx.mapTargetScanIds);
      ctx.recordDebug({ phase: "local-files", message: "Overlay files expanded.", details: summarizeLocalImportFiles(files) });
      await importBuilderFiles(ctx, { files, label: "map", applyInventory(inventory) {
        const nextBuilder = addMapToBuilder(ctx.builder, inventory, effectiveTargetScanIds);
        setBuilderStudy(ctx, nextBuilder);
        ctx.setStatus(`Added map layer for ${effectiveTargetScanIds.join(", ") || "all scans"}.`);
      } });
    },
    async importDirectoryWithPicker() {
      await importDirectoryWithPicker(ctx);
    },
    async replaceFromHostManifestUrl(manifestUrl) {
      await replaceFromHostManifestUrl(ctx, manifestUrl);
    },
    cancelImport() {
      ctx.importAbortRef.current?.abort();
      ctx.workerClientRef.current?.dispose();
      ctx.workerClientRef.current = null;
      ctx.setStatus("Cancelling import...");
    },
    toggleMapTarget(scanId) {
      ctx.setMapTargetScanIds((current) => toggleScanId(current, scanId));
    },
  };
}

async function prepareFileListImport(ctx: DemoImportActionContext, fileList: FileList | null, label: string): Promise<LocalImportFile[] | undefined> {
  if (ctx.importAbortRef.current) {
    ctx.setStatus("An import is already running.");
    ctx.recordDebug({ phase: "import", message: "Import blocked because another import is running." });
    return undefined;
  }
  if (!fileList || fileList.length === 0) {
    ctx.recordDebug({ phase: "import", message: "Import ignored because no files were selected." });
    return undefined;
  }

  ctx.setIsImporting(true);
  ctx.setStatus(`Preparing ${label} import...`);
  try {
    const files = await filesFromFileList(fileList);
    if (files.length === 0) {
      ctx.setStatus("No importable files were selected.");
      ctx.recordDebug({ phase: "import", message: "Import ignored because no importable files were selected." });
      ctx.setIsImporting(false);
      return undefined;
    }
    return files;
  } catch (error) {
    const message = errorMessage(error);
    ctx.setStatus(message);
    ctx.recordDebug({ phase: "error", message, details: error instanceof Error ? error.stack ?? error.message : error });
    ctx.setIsImporting(false);
    return undefined;
  }
}

async function importDirectoryWithPicker(ctx: DemoImportActionContext) {
  ctx.recordDebug({ phase: "directory-picker", message: "Opening native directory picker." });
  const result = await pickDirectoryFiles();
  if (result.error) {
    ctx.setStatus(result.error);
    ctx.recordDebug({ phase: "directory-picker", message: result.error });
  }
  if (result.files) {
    ctx.recordDebug({ phase: "local-files", message: "Directory picker files expanded.", details: summarizeLocalImportFiles(result.files) });
    await importReplacement(ctx, result.files);
  }
}

async function replaceFromHostManifestUrl(ctx: DemoImportActionContext, manifestUrl: string) {
  await runImportAction(ctx, "manifest", async (abortController) => {
    const result = await localImportFilesFromHostManifestUrl(manifestUrl, {
      signal: abortController.signal,
      onDebug: (phase, message, details) => ctx.recordDebug({ phase, message, details }),
    });
    ctx.recordDebug({ phase: "local-files", message: "Manifest files expanded.", details: summarizeLocalImportFiles(result.files) });
    await replaceStudyFromFiles(ctx, { files: result.files, abortController, studyOptions: {
      uid: result.manifest.studyUid ?? `host-manifest-${Date.now()}`,
      label: result.manifest.label ?? `Host manifest (${result.files.length} files)`,
    } });
  });
}

async function importReplacement(ctx: DemoImportActionContext, files: readonly LocalImportFile[]) {
  await runFileImport(ctx, { files, label: "files", action: (abortController) => replaceStudyFromFiles(ctx, { files, abortController, studyOptions: {
    uid: `local-import-${Date.now()}`,
    label: `Local import (${files.length} files)`,
  } }) });
}

async function importBuilderFiles(ctx: DemoImportActionContext, { files, label, applyInventory }: BuilderImportOptions) {
  await runFileImport(ctx, { files, label, async action(abortController) {
    const inventory = await readInventory(ctx, files, abortController);
    ctx.recordDebug({ phase: "inventory", message: `Builder inventory created for ${label}.`, details: inventorySummary(inventory) });
    ctx.assetByPathRef.current = mergeAssetMaps(ctx.assetByPathRef.current, assetByPathFromFiles(files));
    applyInventory(inventory);
    ctx.setAssetResolver(createDemoAssetResolver(ctx.assetByPathRef.current));
    ctx.setViewportRenderer(cornerstoneStackRenderer);
  } });
}

async function replaceStudyFromFiles(ctx: DemoImportActionContext, { files, abortController, studyOptions }: ReplacementStudyOptions) {
  const inventory = await readInventory(ctx, files, abortController);
  const assetByPath = assetByPathFromFiles(files);
  const nextStudy = assembleClinicalStudy(createClinicalStudyInputFromDicomInventory(inventory, studyOptions));
  ctx.recordDebug({ phase: "inventory", message: "Replacement inventory created.", details: inventorySummary(inventory) });
  ctx.recordDebug({ phase: "study", message: "Clinical study assembled.", details: { scans: nextStudy.scans.length, series: nextStudy.series.length, overlays: nextStudy.overlays.length } });
  ctx.setStudy(nextStudy);
  const nextBuilder = createDemoStudyBuilderFromStudy(nextStudy);
  ctx.setBuilder(nextBuilder);
  ctx.setMapTargetScanIds(new Set());
  ctx.assetByPathRef.current = assetByPath;
  ctx.setAssetResolver(createDemoAssetResolver(assetByPath));
  ctx.setViewportRenderer(cornerstoneStackRenderer);
  ctx.setStatus(`Imported ${files.length} files, ${nextStudy.series.length} series, ${nextStudy.overlays.length} overlays.`);
}

async function readInventory(ctx: DemoImportActionContext, files: readonly LocalImportFile[], abortController: AbortController): Promise<DicomInventoryResult> {
  return inventoryFromLocalFiles(files, {
    workerClientRef: ctx.workerClientRef,
    signal: abortController.signal,
    setStatus(nextStatus) {
      ctx.setStatus(nextStatus);
      ctx.recordDebug({ phase: "inventory", message: nextStatus });
    },
  });
}

async function runFileImport(ctx: DemoImportActionContext, { files, label, action }: FileImportOptions) {
  if (ctx.importAbortRef.current || files.length === 0) {
    ctx.setStatus(ctx.importAbortRef.current ? "An import is already running." : ctx.status);
    ctx.recordDebug({ phase: "import", message: ctx.importAbortRef.current ? "Import blocked because another import is running." : "Import ignored because no files were selected." });
    return;
  }
  await runImportAction(ctx, `${label} (${files.length} files)`, action);
}

async function runImportAction(ctx: DemoImportActionContext, label: string, action: (abortController: AbortController) => Promise<void>) {
  if (ctx.importAbortRef.current) {
    ctx.setStatus("An import is already running.");
    ctx.recordDebug({ phase: "import", message: "Import blocked because another import is running." });
    return;
  }
  const abortController = new AbortController();
  ctx.importAbortRef.current = abortController;
  ctx.setIsImporting(true);
  ctx.setStatus(`Reading ${label}...`);
  ctx.recordDebug({ phase: "import", message: `Import started: ${label}.` });
  try {
    await action(abortController);
  } catch (error) {
    const message = abortController.signal.aborted ? "Import cancelled." : errorMessage(error);
    ctx.setStatus(message);
    ctx.recordDebug({ phase: "error", message, details: error instanceof Error ? error.stack ?? error.message : error });
  } finally {
    if (ctx.importAbortRef.current === abortController) {
      ctx.importAbortRef.current = null;
      ctx.setIsImporting(false);
      ctx.recordDebug({ phase: "import", message: `Import finished: ${label}.` });
    }
  }
}

function setBuilderStudy(ctx: DemoImportActionContext, nextBuilder: DemoStudyBuilderState) {
  ctx.setBuilder(nextBuilder);
  ctx.setStudy(buildDemoClinicalStudy(nextBuilder));
}

function inventorySummary(inventory: DicomInventoryResult): Record<string, unknown> {
  return {
    entries: inventory.entries.length,
    series: inventory.series.length,
    seriesKinds: inventory.series.map((series) => ({
      key: series.key,
      kind: series.kind,
      instances: series.instanceCount,
      firstPosition: series.instances[0]?.metadata?.imagePositionPatient,
      lastPosition: series.instances.at(-1)?.metadata?.imagePositionPatient,
    })),
  };
}

function toggleScanId(current: ReadonlySet<string>, scanId: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(scanId)) {
    next.delete(scanId);
  } else {
    next.add(scanId);
  }
  return next;
}
