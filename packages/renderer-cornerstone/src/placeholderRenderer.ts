import type { ClinicalViewportRenderer } from "@pycom-next/react-viewer";

export function createCornerstonePlaceholderRenderer(): ClinicalViewportRenderer {
  return {
    id: "cornerstone-placeholder",
    render({ element, scan, activeSeries, baseSeries, functionalSeries, overlays, assets }) {
      const shell = document.createElement("article");
      shell.className = "pycom-cornerstone-placeholder";

      const eyebrow = document.createElement("p");
      eyebrow.className = "pycom-next-eyebrow";
      eyebrow.textContent = "Cornerstone adapter boundary";

      const title = document.createElement("h2");
      title.textContent = scan?.label ?? "No scan selected";

      const summary = document.createElement("p");
      summary.textContent = `Active ${activeSeries?.label ?? "none"} / Base ${baseSeries?.modality ?? "none"} / Functional ${
        functionalSeries?.modality ?? "none"
      }`;

      const assetSummary = document.createElement("p");
      assetSummary.textContent = `Assets ${assets.activeSeries.length} active / ${assets.baseSeries.length} base / ${
        assets.functionalSeries.length
      } functional / ${overlayAssetCount(assets.overlays)} overlay`;

      const overlayList = document.createElement("ul");
      overlayList.className = "pycom-cornerstone-placeholder-overlays";
      for (const overlay of overlays) {
        const item = document.createElement("li");
        item.textContent = `${overlay.kind}: ${overlay.label}`;
        overlayList.append(item);
      }

      shell.append(eyebrow, title, summary, assetSummary, overlayList);
      element.append(shell);

      return () => shell.remove();
    },
  };
}

function overlayAssetCount(overlays: readonly { assets: readonly unknown[] }[]): number {
  return overlays.reduce((total, overlay) => total + overlay.assets.length, 0);
}
