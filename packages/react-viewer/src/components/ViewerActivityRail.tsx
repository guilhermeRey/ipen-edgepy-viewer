import type { ReactNode } from "react";

export type ViewerBuiltInPanelKey = "scans" | "overlays";
export type ViewerPanelKey = ViewerBuiltInPanelKey | string;

export interface ViewerActivityRailPanel {
  badge?: number | undefined;
  icon?: ReactNode;
  key: string;
  label: string;
}

interface ViewerActivityRailProps {
  activePanel?: ViewerPanelKey | undefined;
  customPanels?: readonly ViewerActivityRailPanel[] | undefined;
  overlayCount: number;
  railActions?: ReactNode;
  scanCount: number;
  onPanelToggle(panel: ViewerPanelKey): void;
}

export function ViewerActivityRail({ activePanel, customPanels, overlayCount, railActions, scanCount, onPanelToggle }: Readonly<ViewerActivityRailProps>) {
  return (
    <nav className="pycom-next-activity-rail" aria-label="Clinical workspaces">
      <RailButton
        active={activePanel === "scans"}
        badge={scanCount}
        icon="scans"
        label="Scans"
        onClick={() => onPanelToggle("scans")}
      />
      <RailButton
        active={activePanel === "overlays"}
        badge={overlayCount}
        icon="overlays"
        label="Overlays"
        onClick={() => onPanelToggle("overlays")}
      />
      {customPanels?.map((panel) => (
        <RailButton
          key={panel.key}
          active={activePanel === panel.key}
          badge={panel.badge}
          icon={panel.icon}
          label={panel.label}
          onClick={() => onPanelToggle(panel.key)}
        />
      ))}
      {railActions ? <div className="pycom-next-rail-footer">{railActions}</div> : null}
    </nav>
  );
}

function RailButton({ active, badge, icon, label, onClick }: Readonly<{ active: boolean; badge?: number | undefined; icon?: ReactNode | ViewerBuiltInPanelKey | undefined; label: string; onClick(): void }>) {
  return (
    <button type="button" className="pycom-next-rail-button" data-label={label} aria-pressed={active} aria-label={`${active ? "Hide" : "Show"} ${label}`} onClick={onClick}>
      {isBuiltInPanelKey(icon) ? <RailIcon name={icon} /> : icon ?? <RailIcon name="scans" />}
      <span>{label}</span>
      {typeof badge === "number" ? <strong>{badge}</strong> : null}
    </button>
  );
}

function isBuiltInPanelKey(value: ReactNode | ViewerBuiltInPanelKey | undefined): value is ViewerBuiltInPanelKey {
  return value === "scans" || value === "overlays";
}

function RailIcon({ name }: Readonly<{ name: ViewerBuiltInPanelKey }>) {
  if (name === "overlays") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 3 8l9 4 9-4-9-4Z" />
        <path d="m3 12 9 4 9-4" />
        <path d="m3 16 9 4 9-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
      <path d="M8 5v14" />
    </svg>
  );
}
