import * as Schema from "effect/Schema";
import { useEffect } from "react";

import { useLocalStorage } from "./hooks/useLocalStorage";

const LEONIDAS_GRID_STORAGE_KEY = "leonidas-code:appearance-grid";
const LEONIDAS_GLOW_STORAGE_KEY = "leonidas-code:appearance-glow";
// Off by default: Jake rejected glow on the canvas (2026-10-20, 2026-10-22). People can turn it on.
export const DEFAULT_LEONIDAS_GLOW_STRENGTH = 0;

export function clampLeonidasGlowStrength(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LEONIDAS_GLOW_STRENGTH;
  return Math.min(100, Math.max(0, Math.round(value / 5) * 5));
}

export function useLeonidasAtmosphere() {
  const [showGrid, setShowGrid] = useLocalStorage(LEONIDAS_GRID_STORAGE_KEY, false, Schema.Boolean);
  const [storedGlowStrength, setGlowStrength] = useLocalStorage(
    LEONIDAS_GLOW_STORAGE_KEY,
    DEFAULT_LEONIDAS_GLOW_STRENGTH,
    Schema.Number,
  );
  const glowStrength = clampLeonidasGlowStrength(storedGlowStrength);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.leonidasGrid = String(showGrid);
    root.style.setProperty("--leonidas-glow-opacity", String((glowStrength / 100) * 0.22));
  }, [glowStrength, showGrid]);

  return {
    glowStrength,
    setGlowStrength: (value: number) => setGlowStrength(clampLeonidasGlowStrength(value)),
    setShowGrid,
    showGrid,
  };
}
