/**
 * Brain Visualizer Type Definitions
 * Adheres to Card 5 of the MAPS framework and standards/screen-standard.md
 */

export type BrainNodeKind =
  | "root"
  | "area"
  | "project"
  | "skill"
  | "memory"
  | "note"
  | "routine"
  | "run"
  | "app";

export type BrainNodeLayer = "core" | "memory" | "skills" | "routines" | "apps" | "runs";

export interface BrainNode {
  id: string;
  kind: BrainNodeKind;
  label: string;
  area: string;
  layer: BrainNodeLayer;
  path: string;
  note?: string;
  changed?: string;
}

export interface BrainLink {
  s: string;
  t: string;
}

export interface BrainGraphSummary {
  total_nodes: number;
  total_links: number;
  layers: string[];
  areas: string[];
}

export interface BrainGraphData {
  generated_at?: string;
  version?: string;
  summary?: BrainGraphSummary;
  nodes: BrainNode[];
  links: BrainLink[];
}

export type BrainViewMode = "rings" | "areas" | "timeline" | "orbit";

export interface NodePosition {
  x: number;
  y: number;
  z?: number;
}
