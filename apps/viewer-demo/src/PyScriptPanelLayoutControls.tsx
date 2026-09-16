import type { ViewerCustomPanelPresentation } from "@pycom-next/react-viewer";

export function PyScriptPanelLayoutControls({ presentation, onChange }: Readonly<{ presentation: ViewerCustomPanelPresentation; onChange(presentation: ViewerCustomPanelPresentation): void }>) {
  const docked = presentation === "bottom";
  const maximized = presentation === "fullscreen";
  return (
    <div className="demo-python-agent-layout-actions" aria-label="Editor layout">
      <button type="button" aria-pressed={docked} title={docked ? "Restore side panel" : "Dock at bottom"} onClick={() => onChange(docked ? "side" : "bottom")}>
        <DockIcon />
        <span>{docked ? "Side" : "Dock"}</span>
      </button>
      <button type="button" aria-pressed={maximized} title={maximized ? "Restore side panel" : "Maximize editor"} onClick={() => onChange(maximized ? "side" : "fullscreen")}>
        <MaximizeIcon />
        <span>{maximized ? "Restore" : "Maximize"}</span>
      </button>
    </div>
  );
}

function DockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 14h18" /></svg>;
}

function MaximizeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>;
}
