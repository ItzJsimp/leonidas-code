// The page one overlay window shows: a frozen frame, a dim layer, and the box the user is picking.
export type SnipOverlayPageInput = {
  readonly displayId: number;
  /** File name of the frozen frame, next to the page. */
  readonly frameFile: string;
  /** Physical pixel origin of this display in the desktop space. */
  readonly originX: number;
  readonly originY: number;
  readonly scaleFactor: number;
};

export function renderSnipOverlayPage(input: SnipOverlayPageInput): string {
  const config = JSON.stringify({
    displayId: input.displayId,
    originX: input.originX,
    originY: input.originY,
    scale: input.scaleFactor,
  });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>Snip</title>
<style>
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; cursor: crosshair; user-select: none; font: 12px system-ui, sans-serif; }
#frame { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#dim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); pointer-events: none; }
#box { position: fixed; display: none; box-sizing: border-box; border: 2px solid #4da3ff; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.35); pointer-events: none; }
#label { position: fixed; display: none; padding: 2px 8px; border-radius: 4px; background: #1b6fd1; color: #fff; pointer-events: none; white-space: nowrap; }
#hint { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); padding: 6px 12px; border-radius: 6px; background: rgba(0, 0, 0, 0.7); color: #fff; pointer-events: none; }
</style>
</head>
<body>
<img id="frame" alt="" src="${input.frameFile}">
<div id="dim"></div>
<div id="box"></div>
<div id="label"></div>
<div id="hint">Click a window, or drag an area. Esc to cancel.</div>
<script>
(() => {
  const config = ${config};
  const bridge = window.snipOverlay;
  const box = document.getElementById("box");
  const dim = document.getElementById("dim");
  const label = document.getElementById("label");
  const toLocal = (rect) => ({
    x: (rect.x - config.originX) / config.scale,
    y: (rect.y - config.originY) / config.scale,
    width: rect.width / config.scale,
    height: rect.height / config.scale,
  });
  const send = (type, event) => bridge.send({
    type,
    displayId: config.displayId,
    x: event ? event.clientX : 0,
    y: event ? event.clientY : 0,
  });
  document.addEventListener("mousemove", (event) => send("move", event));
  document.addEventListener("mousedown", (event) => { if (event.button === 0) send("down", event); });
  document.addEventListener("mouseup", (event) => { if (event.button === 0) send("up", event); });
  document.addEventListener("contextmenu", (event) => { event.preventDefault(); send("cancel"); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") send("cancel"); });
  bridge.onView((view) => {
    const rect = view && (view.selection || view.highlight);
    if (!rect) {
      box.style.display = "none";
      label.style.display = "none";
      dim.style.display = "block";
      return;
    }
    const local = toLocal(rect);
    dim.style.display = "none";
    box.style.display = "block";
    box.style.left = local.x + "px";
    box.style.top = local.y + "px";
    box.style.width = local.width + "px";
    box.style.height = local.height + "px";
    const text = view.selection
      ? Math.round(rect.width) + " x " + Math.round(rect.height)
      : (view.label || "");
    label.textContent = text;
    label.style.display = text ? "block" : "none";
    label.style.left = Math.max(0, local.x) + "px";
    label.style.top = Math.max(0, local.y - 24) + "px";
    document.getElementById("hint").style.display = "none";
  });
})();
</script>
</body>
</html>
`;
}
