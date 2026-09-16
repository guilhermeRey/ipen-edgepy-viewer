import type { OverlayRef } from "@pycom-next/core";
import { LayerOpacityControl } from "./LayerOpacityControl";
import {
  groupOverlaysByGroup,
  overlayColor,
  overlayOpacity,
  overlayToggleActionLabel,
  overlayVisibilityLabel,
} from "../presentation/overlayPresentation";

interface OverlayTreeSectionProps {
  drawableOverlays: readonly OverlayRef[];
  overlayOpacityByUid: ReadonlyMap<string, number>;
  visibleOverlayUids: ReadonlySet<string>;
  onOverlayToggle(overlayUid: string): void;
  onOverlayOpacityChange(overlayUid: string, opacity: number): void;
}

export function OverlayTreeSection({
  drawableOverlays,
  overlayOpacityByUid,
  visibleOverlayUids,
  onOverlayToggle,
  onOverlayOpacityChange,
}: Readonly<OverlayTreeSectionProps>) {
  const overlayGroups = groupOverlaysByGroup(drawableOverlays);
  const visibleOverlayCount = drawableOverlays.filter((overlay) => visibleOverlayUids.has(overlay.uid)).length;

  return (
    <section>
      <header className="pycom-next-section-heading">
        <h3>Overlays / VOIs</h3>
        <span>{visibleOverlayCount}/{drawableOverlays.length} visible</span>
      </header>
      <div className="pycom-next-overlay-tree" aria-label="Overlays in selected scan">
        {overlayGroups.map((group) => (
          <article key={group.key} className="pycom-next-overlay-group">
            <div className="pycom-next-overlay-group-title">
              <span>{group.label}</span>
              <strong>{visibleCount(group.overlays, visibleOverlayUids)}/{group.overlays.length}</strong>
            </div>
            <ul className="pycom-next-list pycom-next-overlay-list">
              {group.overlays.map(({ overlay, index }) => (
                <OverlayTreeItem
                  key={overlay.uid}
                  index={index}
                  overlay={overlay}
                  opacity={overlayOpacityByUid.get(overlay.uid) ?? overlayOpacity(overlay)}
                  visible={visibleOverlayUids.has(overlay.uid)}
                  onOverlayToggle={onOverlayToggle}
                  onOverlayOpacityChange={onOverlayOpacityChange}
                />
              ))}
            </ul>
          </article>
        ))}
      </div>
      {drawableOverlays.length === 0 ? <p className="pycom-next-muted">No renderable mask or dose overlays detected for this scan.</p> : null}
    </section>
  );
}

function OverlayTreeItem({
  index,
  overlay,
  opacity,
  visible,
  onOverlayToggle,
  onOverlayOpacityChange,
}: Readonly<{
  index: number;
  overlay: OverlayRef;
  opacity: number;
  visible: boolean;
  onOverlayToggle(overlayUid: string): void;
  onOverlayOpacityChange(overlayUid: string, opacity: number): void;
}>) {
  return (
    <li data-visible={visible ? "true" : "false"}>
      <button
        type="button"
        className="pycom-next-overlay-button"
        aria-pressed={visible}
        aria-label={overlayToggleActionLabel(overlay, visible)}
        onClick={() => onOverlayToggle(overlay.uid)}
      >
        <span className="pycom-next-overlay-swatch" style={{ backgroundColor: overlayColor(overlay, index) }} />
        <span className="pycom-next-overlay-text">
          <strong>{overlay.structure ?? overlay.label}</strong>
          <small>{overlayDetail(overlay)}</small>
        </span>
        <span className="pycom-next-overlay-state">
          <strong>{visible ? "Hide" : "Show"}</strong>
          <small>{overlayVisibilityLabel(visible)}</small>
        </span>
      </button>
      {visible ? <LayerOpacityControl label="Opacity" value={opacity} onChange={(nextOpacity) => onOverlayOpacityChange(overlay.uid, nextOpacity)} /> : null}
    </li>
  );
}

function overlayDetail(overlay: OverlayRef): string {
  return [overlay.group, overlay.kind.toUpperCase()].filter(Boolean).join(" / ");
}

function visibleCount(items: readonly { overlay: OverlayRef }[], visibleOverlayUids: ReadonlySet<string>): number {
  return items.filter((item) => visibleOverlayUids.has(item.overlay.uid)).length;
}
