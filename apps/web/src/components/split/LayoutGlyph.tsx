import { memo, useMemo } from "react";

import { applyPreset, computeRects, type LayoutPresetId } from "../../splitLayout";

/** Miniature of a layout preset, drawn from the same rectangles the workspace uses. */
export const LayoutGlyph = memo(function LayoutGlyph({ preset }: { preset: LayoutPresetId }) {
  const rects = useMemo(() => [...computeRects(applyPreset(null, preset)).values()], [preset]);
  return (
    <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0" aria-hidden="true">
      {rects.map((rect) => (
        <rect
          key={`${rect.x}:${rect.y}`}
          x={rect.x * 24 + 0.75}
          y={rect.y * 16 + 0.75}
          width={rect.w * 24 - 1.5}
          height={rect.h * 16 - 1.5}
          rx={1.5}
          className="fill-current opacity-30 stroke-current"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
});
