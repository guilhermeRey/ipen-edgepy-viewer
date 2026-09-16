export const pycomTokens = {
  color: {
    background: "#080C16",
    surface: "#0B1120",
    surfaceRaised: "#1B2436",
    text: "#E8EDF6",
    muted: "#93A0B8",
    accent: "#2BE3D2",
    warning: "#FFD23F",
    danger: "#ef4444",
  },
  radius: {
    small: "6px",
    medium: "10px",
    large: "16px",
  },
} as const;

export type PycomTokens = typeof pycomTokens;
