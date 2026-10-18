import type { BrainGraphData, BrainNode, BrainViewMode, NodePosition } from "./brainTypes";

export interface LayoutGuide {
  text: string;
  x: number;
  y: number;
  align: "left" | "center";
}

export interface LayoutResult {
  pos: Record<string, NodePosition>;
  guides: LayoutGuide[];
}

const AREA_ORDER = ["core", "business", "system", "dev", "personal"];
const GOLDEN_ANGLE = 2.399963229728653;

function areaRank(area: string): number {
  const index = AREA_ORDER.indexOf(area);
  return index < 0 ? AREA_ORDER.length : index;
}

/** Group nodes by area so colors sit together, then by label so order is stable. */
function sortedNodes(nodes: readonly BrainNode[]): BrainNode[] {
  return [...nodes].toSorted(
    (a, b) => areaRank(a.area) - areaRank(b.area) || a.label.localeCompare(b.label),
  );
}

function ringLayout(nodes: readonly BrainNode[], w: number, h: number): LayoutResult {
  const cx = w / 2;
  const cy = h / 2;
  const reach = Math.min(cx, cy) - 36;
  const fractions: Record<string, number> = {
    core: 0.16,
    memory: 0.4,
    skills: 0.66,
    routines: 0.82,
    apps: 0.95,
    runs: 1,
  };
  const byLayer = new Map<string, BrainNode[]>();
  for (const node of sortedNodes(nodes)) {
    if (node.id === "root") continue;
    const list = byLayer.get(node.layer) ?? [];
    list.push(node);
    byLayer.set(node.layer, list);
  }
  const pos: Record<string, NodePosition> = { root: { x: cx, y: cy, z: 1 } };
  const guides: LayoutGuide[] = [];
  for (const [layer, list] of byLayer) {
    const radius = reach * (fractions[layer] ?? 0.7);
    list.forEach((node, i) => {
      const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2;
      pos[node.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, z: 1 };
    });
    guides.push({ text: layer, x: cx, y: cy - radius - 8, align: "center" });
  }
  return { pos, guides };
}

function areaLayout(nodes: readonly BrainNode[], w: number, h: number): LayoutResult {
  const spacing = Math.min(w, h) * 0.0155;
  const centers: Record<string, [number, number]> = {
    core: [0.5, 0.17],
    system: [0.17, 0.5],
    business: [0.83, 0.5],
    dev: [0.5, 0.64],
    personal: [0.84, 0.86],
  };
  const pos: Record<string, NodePosition> = {};
  const counters: Record<string, number> = {};
  for (const node of sortedNodes(nodes)) {
    const [fx, fy] = centers[node.area] ?? [0.5, 0.5];
    const cx = fx * w;
    const cy = fy * h;
    if (node.kind === "area" || node.id === "root") {
      pos[node.id] = { x: cx, y: cy, z: 1 };
      continue;
    }
    const index = (counters[node.area] = (counters[node.area] ?? 0) + 1);
    const radius = spacing * Math.sqrt(index) + spacing;
    const angle = index * GOLDEN_ANGLE;
    pos[node.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, z: 1 };
  }
  return { pos, guides: [] };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(day: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day || "unknown";
  return `${MONTHS[Number(match[1]) - 1] ?? match[1]} ${Number(match[2])}`;
}

/** One column per day, oldest left, newest right; busy days wrap into sub-columns. */
function timelineLayout(nodes: readonly BrainNode[], w: number, h: number): LayoutResult {
  const side = 36;
  const top = 28;
  const bottom = 56;
  const dot = 9;
  const rowsPerColumn = Math.max(4, Math.floor((h - top - bottom) / dot));
  const days = [...new Set(nodes.map((node) => node.changed ?? ""))].toSorted();
  const columnsPerDay = days.map(
    (day) =>
      Math.ceil(nodes.filter((node) => (node.changed ?? "") === day).length / rowsPerColumn) || 1,
  );
  const totalColumns = columnsPerDay.reduce((sum, n) => sum + n, 0);
  const gapColumns = Math.max(0, days.length - 1);
  const step = Math.min(14, (w - side * 2) / Math.max(1, totalColumns + gapColumns * 1.5));
  const pos: Record<string, NodePosition> = {};
  const guides: LayoutGuide[] = [];
  let x = side;
  days.forEach((day, d) => {
    const list = sortedNodes(nodes.filter((node) => (node.changed ?? "") === day));
    list.forEach((node, i) => {
      pos[node.id] = {
        x: x + Math.floor(i / rowsPerColumn) * step,
        y: h - bottom - (i % rowsPerColumn) * dot,
        z: 1,
      };
    });
    const width = (columnsPerDay[d]! - 1) * step;
    guides.push({ text: dayLabel(day), x: x + width / 2, y: h - bottom + 22, align: "center" });
    guides.push({ text: `${list.length}`, x: x + width / 2, y: h - bottom + 38, align: "center" });
    x += columnsPerDay[d]! * step + step * 1.5;
  });
  return { pos, guides };
}

function orbitLayout(
  nodes: readonly BrainNode[],
  w: number,
  h: number,
  angle: number,
): LayoutResult {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const distance = radius * 3.2;
  const tilt = 0.35;
  const pos: Record<string, NodePosition> = {};
  const others = sortedNodes(nodes).filter((node) => node.id !== "root");
  others.forEach((node, i) => {
    const y = 1 - (2 * (i + 0.5)) / others.length;
    const ring = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE + angle;
    const x3 = radius * ring * Math.cos(theta);
    const z3 = radius * ring * Math.sin(theta);
    const y3 = radius * y;
    const yTilted = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
    const zTilted = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
    const scale = distance / (distance + zTilted);
    pos[node.id] = { x: cx + x3 * scale, y: cy + yTilted * scale, z: scale };
  });
  pos.root = { x: cx, y: cy, z: 1.3 };
  return { pos, guides: [] };
}

export function layoutNodes(
  view: BrainViewMode,
  graph: BrainGraphData,
  w: number,
  h: number,
  angle: number,
): LayoutResult {
  switch (view) {
    case "rings":
      return ringLayout(graph.nodes, w, h);
    case "areas":
      return areaLayout(graph.nodes, w, h);
    case "timeline":
      return timelineLayout(graph.nodes, w, h);
    case "orbit":
      return orbitLayout(graph.nodes, w, h, angle);
  }
}
