import { useEffect, useRef } from "react";

import { PET_CELL_HEIGHT, PET_CELL_WIDTH, PET_STATE_DEFS, type PetState } from "./petAtlas";
import { drawPlaceholderPet } from "./petPlaceholder";

interface PetPlayerProps {
  readonly state: PetState;
  /** Petdex atlas image. Without one the player draws the placeholder body. */
  readonly sheet?: HTMLImageElement | undefined;
  readonly scale?: number;
}

/**
 * Steps through one state's frames with a timer set to the next frame boundary, not a
 * continuous paint loop, and stops entirely while the page is hidden.
 */
export function PetPlayer({ state, sheet, scale = 0.6 }: PetPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { row, frames } = PET_STATE_DEFS[state];
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const draw = () => {
      const frame = frames[index]!;
      if (sheet) {
        ctx.clearRect(0, 0, PET_CELL_WIDTH, PET_CELL_HEIGHT);
        ctx.drawImage(
          sheet,
          frame.col * PET_CELL_WIDTH,
          row * PET_CELL_HEIGHT,
          PET_CELL_WIDTH,
          PET_CELL_HEIGHT,
          0,
          0,
          PET_CELL_WIDTH,
          PET_CELL_HEIGHT,
        );
      } else {
        drawPlaceholderPet(ctx, state, frame.col, frames.length);
      }
      timer = setTimeout(() => {
        index = (index + 1) % frames.length;
        draw();
      }, frame.durationMs);
    };

    const onVisibility = () => {
      clearTimeout(timer);
      if (!document.hidden) draw();
    };

    if (!document.hidden) draw();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state, sheet]);

  return (
    <canvas
      ref={canvasRef}
      width={PET_CELL_WIDTH}
      height={PET_CELL_HEIGHT}
      style={{ width: PET_CELL_WIDTH * scale, height: PET_CELL_HEIGHT * scale }}
      aria-hidden="true"
    />
  );
}
