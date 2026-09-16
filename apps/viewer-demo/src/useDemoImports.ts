import { useEffect, useRef, useState } from "react";
import { createEmptyStudy, type ClinicalStudy } from "@pycom-next/core";
import type { DicomInventoryWorkerClient } from "@pycom-next/dicom";
import type { ClinicalViewportAssetResolver, ClinicalViewportRenderer } from "@pycom-next/react-viewer";
import { demoAssetResolver } from "./demoAssetResolver";
import { createDemoImportActions } from "./demoImportActions";
import { useImportDebug } from "./useImportDebug";
import { createEmptyDemoStudyBuilder, scanIdsFromBuilder, type DemoStudyBuilderState } from "./studyBuilder";

interface DemoImportOptions {
  hostManifestUrl?: string | undefined;
}

export function useDemoImports(options: DemoImportOptions = {}) {
  const acquisitionFolderInputRef = useRef<HTMLInputElement | null>(null);
  const mapFolderInputRef = useRef<HTMLInputElement | null>(null);
  const workerClientRef = useRef<DicomInventoryWorkerClient | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const assetByPathRef = useRef<ReadonlyMap<string, Blob>>(new Map());
  const hostManifestUrlRef = useRef<string | undefined>(undefined);
  const [study, setStudy] = useState<ClinicalStudy>(() => createEmptyStudy("empty-local-study", "No study loaded"));
  const [assetResolver, setAssetResolver] = useState<ClinicalViewportAssetResolver>(() => demoAssetResolver);
  const [viewportRenderer, setViewportRenderer] = useState<ClinicalViewportRenderer | undefined>(undefined);
  const [builder, setBuilder] = useState<DemoStudyBuilderState>(() => createEmptyDemoStudyBuilder());
  const [mapTargetScanIds, setMapTargetScanIds] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState("Use Local import for standalone files/folders, or provide legacy window.PYCOM_VIEWER_CONFIG.viewerAssetsUrl for manifest loading.");
  const [isImporting, setIsImporting] = useState(false);
  const debug = useImportDebug();
  const actions = createDemoImportActions({
    assetByPathRef,
    builder,
    importAbortRef,
    mapTargetScanIds,
    recordDebug: debug.recordDebug,
    setAssetResolver,
    setBuilder,
    setIsImporting,
    setMapTargetScanIds,
    setStatus,
    setStudy,
    setViewportRenderer,
    status,
    workerClientRef,
  });

  useEffect(() => {
    acquisitionFolderInputRef.current?.setAttribute("webkitdirectory", "");
    mapFolderInputRef.current?.setAttribute("webkitdirectory", "");
    return () => {
      importAbortRef.current?.abort();
      workerClientRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!options.hostManifestUrl || hostManifestUrlRef.current === options.hostManifestUrl) {
      return;
    }
    hostManifestUrlRef.current = options.hostManifestUrl;
    void actions.replaceFromHostManifestUrl(options.hostManifestUrl);
  }, [options.hostManifestUrl]);

  return {
    acquisitionFolderInputRef,
    assetResolver,
    assetByPath: assetByPathRef.current,
    debugEntries: debug.debugEntries,
    hostManifestUrl: options.hostManifestUrl,
    isImporting,
    mapFolderInputRef,
    mapTargetScanIds,
    scanIds: scanIdsFromBuilder(builder),
    status,
    study,
    viewportRenderer,
    clearDebug: debug.clearDebug,
    ...actions,
  };
}
