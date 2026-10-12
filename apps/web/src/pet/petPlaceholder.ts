import { PET_CELL_HEIGHT, PET_CELL_WIDTH, type PetState } from "./petAtlas";

// Stand-in body drawn straight to the canvas, so no 11 MB atlas bitmap is needed before a
// generated or preset sheet exists. Each state gets its own tint and a frame-driven bob.
const STATE_HUES: Readonly<Record<PetState, number>> = {
  idle: 210,
  "running-right": 150,
  "running-left": 150,
  waving: 40,
  jumping: 300,
  failed: 0,
  waiting: 55,
  running: 170,
  review: 260,
};

export function drawPlaceholderPet(
  ctx: CanvasRenderingContext2D,
  state: PetState,
  col: number,
  frameCount: number,
): void {
  const phase = (col / Math.max(frameCount, 1)) * Math.PI * 2;
  const lift = state === "jumping" ? Math.abs(Math.sin(phase / 2)) * 36 : Math.sin(phase) * 5;
  const lean = state === "running-right" ? 8 : state === "running-left" ? -8 : 0;
  const cx = PET_CELL_WIDTH / 2 + lean;
  const cy = PET_CELL_HEIGHT * 0.62 - lift;
  const hue = STATE_HUES[state];

  ctx.clearRect(0, 0, PET_CELL_WIDTH, PET_CELL_HEIGHT);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(PET_CELL_WIDTH / 2, PET_CELL_HEIGHT * 0.9, 44 - lift / 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${hue} 70% 58%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 52, 58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111";
  const eyeY = cy - 12;
  const blink = state === "idle" && col === 3 ? 2 : 9;
  for (const dx of [-18, 18]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx + lean / 2, eyeY, 7, blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state === "failed") {
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy + 30, 14, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
}
