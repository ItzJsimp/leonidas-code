/**
 * LeonidasVault.logic.ts — Pure logic engine for Leonidas Vault (Obsidian replacement)
 * and the 3D Interactive Knowledge Graph.
 *
 * Provides:
 * 1. Wiki-link parsing: `[[Note Name]]`, `[[Note Name|Alias]]`, `[[Note Name#Header]]`
 * 2. Tag extraction: frontmatter YAML and inline `#tag`
 * 3. Bidirectional graph synthesis: Nodes, Links, In/Out degree, and Backlinks
 * 4. 3D force-directed layout mathematics (Coulomb repulsion, Hooke springs, centering gravity)
 * 5. 3D-to-2D perspective projection with spherical orbit camera
 * 6. Starter knowledge base for instant out-of-the-box exploration
 */

export interface VaultNote {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly path: string;
  readonly tags: ReadonlyArray<string>;
  readonly outgoingLinks: ReadonlyArray<string>;
  readonly updatedAt: number;
  readonly createdAt: number;
}

export type GraphNodeKind = "note" | "tag" | "hub";

export interface GraphNode3D {
  readonly id: string;
  readonly label: string;
  readonly kind: GraphNodeKind;
  readonly path?: string;
  readonly tags: ReadonlyArray<string>;
  readonly linkCount: number;
  readonly inDegree: number;
  readonly outDegree: number;
  readonly radius: number;
  readonly color: string;
  readonly glowColor: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface GraphLink3D {
  readonly source: string;
  readonly target: string;
  readonly kind: "wiki" | "tag";
  readonly strength: number;
}

export interface GraphData3D {
  readonly nodes: ReadonlyArray<GraphNode3D>;
  readonly links: ReadonlyArray<GraphLink3D>;
  readonly backlinksByNoteId: Readonly<
    Record<string, ReadonlyArray<{ sourceId: string; title: string }>>
  >;
}

export interface Camera3D {
  theta: number; // azimuth angle in radians
  phi: number; // elevation angle in radians (-PI/2 to PI/2)
  radius: number; // distance from target
  targetX: number;
  targetY: number;
  targetZ: number;
  fov: number;
}

export interface ProjectedPoint {
  readonly screenX: number;
  readonly screenY: number;
  readonly depth: number;
  readonly scale: number;
  readonly visible: boolean;
}

/**
 * Normalizes note title to slug/id.
 */
export function normalizeNoteId(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Extracts all wiki links `[[Note Name]]` or `[[Note Name|Alias]]` from markdown text.
 */
export function extractWikiLinks(
  markdown: string,
): ReadonlyArray<{ target: string; alias?: string }> {
  const links: Array<{ target: string; alias?: string }> = [];
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    const target = match[1]?.trim();
    if (target) {
      const alias = match[2]?.trim();
      links.push(alias ? { target, alias } : { target });
    }
  }

  return links;
}

/**
 * Extracts tags from markdown content (YAML frontmatter + inline #tag).
 */
export function extractTags(markdown: string): ReadonlyArray<string> {
  const tagsSet = new Set<string>();

  // Frontmatter tags: tags: [a, b] or tags: \n - a
  const frontmatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch && frontmatterMatch[1]) {
    const frontmatter = frontmatterMatch[1];
    const arrayMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
    if (arrayMatch && arrayMatch[1]) {
      arrayMatch[1].split(",").forEach((t) => {
        const cleaned = t.trim().replace(/^["']|["']$/g, "");
        if (cleaned) tagsSet.add(cleaned.toLowerCase());
      });
    } else {
      const listMatches = frontmatter.matchAll(/^\s*-\s*([a-zA-Z0-9_-]+)/gm);
      for (const m of listMatches) {
        if (m[1]) tagsSet.add(m[1].toLowerCase());
      }
    }
  }

  // Inline tags: #tag (avoiding markdown headers # Header or code blocks)
  const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
  const strippedCode = markdown.replace(codeBlockRegex, "");

  const inlineRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]+)(?=[^\w-]|$)/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(strippedCode)) !== null) {
    if (inlineMatch[1]) {
      tagsSet.add(inlineMatch[1].toLowerCase());
    }
  }

  return Array.from(tagsSet).sort();
}

/**
 * Parses raw markdown into a structured VaultNote.
 */
export function parseVaultNote(path: string, content: string): VaultNote {
  let title = path.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled Note";

  // Check frontmatter title
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch && frontmatterMatch[1]) {
    const titleMatch = frontmatterMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
    }
  } else {
    // Check first level-1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      title = h1Match[1].trim();
    }
  }

  const id = normalizeNoteId(title);
  const tags = extractTags(content);
  const wikiLinks = extractWikiLinks(content);
  const outgoingLinks = Array.from(new Set(wikiLinks.map((link) => normalizeNoteId(link.target))));

  return {
    id,
    title,
    content,
    path,
    tags,
    outgoingLinks,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}

/**
 * Builds full 3D Graph Data from a collection of VaultNotes.
 */
export function buildGraphDataFromNotes(
  notes: ReadonlyArray<VaultNote>,
  options: { includeTags?: boolean } = { includeTags: true },
): GraphData3D {
  const noteById = new Map<string, VaultNote>();
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  const backlinksMap: Record<string, Array<{ sourceId: string; title: string }>> = {};

  for (const note of notes) {
    noteById.set(note.id, note);
    inDegreeMap.set(note.id, 0);
    outDegreeMap.set(note.id, 0);
    backlinksMap[note.id] = [];
  }

  const links: Array<GraphLink3D> = [];
  const tagNodesMap = new Map<string, Set<string>>(); // tag -> set of note ids

  for (const note of notes) {
    for (const targetId of note.outgoingLinks) {
      if (noteById.has(targetId)) {
        links.push({
          source: note.id,
          target: targetId,
          kind: "wiki",
          strength: 1.0,
        });

        outDegreeMap.set(note.id, (outDegreeMap.get(note.id) ?? 0) + 1);
        inDegreeMap.set(targetId, (inDegreeMap.get(targetId) ?? 0) + 1);
        backlinksMap[targetId]?.push({ sourceId: note.id, title: note.title });
      }
    }

    if (options.includeTags) {
      for (const tag of note.tags) {
        if (!tagNodesMap.has(tag)) {
          tagNodesMap.set(tag, new Set());
        }
        tagNodesMap.get(tag)!.add(note.id);
      }
    }
  }

  const nodes: Array<GraphNode3D> = [];

  // Seed spherical distribution coordinates
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const totalItems = notes.length + (options.includeTags ? tagNodesMap.size : 0);
  let index = 0;

  for (const note of notes) {
    const inDeg = inDegreeMap.get(note.id) ?? 0;
    const outDeg = outDegreeMap.get(note.id) ?? 0;
    const totalDeg = inDeg + outDeg;

    // Fibonacci sphere distribution for uniform 3D positioning
    const theta = (2 * Math.PI * index) / goldenRatio;
    const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(1, totalItems));
    const spreadRadius = 140 + Math.random() * 60;

    const x = spreadRadius * Math.sin(phi) * Math.cos(theta);
    const y = spreadRadius * Math.sin(phi) * Math.sin(theta);
    const z = spreadRadius * Math.cos(phi);

    const isHub = totalDeg >= 4;
    const kind: GraphNodeKind = isHub ? "hub" : "note";
    const radius = Math.min(18, Math.max(5, 5 + totalDeg * 1.8));

    // Futuristic Neon Colors:
    // Hubs: Brilliant Amber / Gold (#ffd700)
    // Regular notes: Electric Cyan (#00f0ff)
    const color = isHub ? "#ffd700" : "#00f0ff";
    const glowColor = isHub ? "rgba(255, 215, 0, 0.45)" : "rgba(0, 240, 255, 0.45)";

    nodes.push({
      id: note.id,
      label: note.title,
      kind,
      path: note.path,
      tags: note.tags,
      linkCount: totalDeg,
      inDegree: inDeg,
      outDegree: outDeg,
      radius,
      color,
      glowColor,
      x,
      y,
      z,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      vz: (Math.random() - 0.5) * 0.5,
    });
    index++;
  }

  // Tag Nodes (represented in neon purple / violet)
  if (options.includeTags) {
    for (const [tag, linkedNotes] of tagNodesMap.entries()) {
      const tagId = `tag:${tag}`;
      const theta = (2 * Math.PI * index) / goldenRatio;
      const phi = Math.acos(1 - (2 * (index + 0.5)) / Math.max(1, totalItems));
      const spreadRadius = 160 + Math.random() * 40;

      const x = spreadRadius * Math.sin(phi) * Math.cos(theta);
      const y = spreadRadius * Math.sin(phi) * Math.sin(theta);
      const z = spreadRadius * Math.cos(phi);

      const degree = linkedNotes.size;
      const radius = Math.min(14, Math.max(4, 4 + degree * 1.2));

      nodes.push({
        id: tagId,
        label: `#${tag}`,
        kind: "tag",
        tags: [tag],
        linkCount: degree,
        inDegree: degree,
        outDegree: 0,
        radius,
        color: "#c084fc",
        glowColor: "rgba(192, 132, 252, 0.45)",
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
      });

      for (const noteId of linkedNotes) {
        links.push({
          source: noteId,
          target: tagId,
          kind: "tag",
          strength: 0.5,
        });
      }
      index++;
    }
  }

  return {
    nodes,
    links,
    backlinksByNoteId: backlinksMap,
  };
}

export interface Physics3DConfig {
  repulsion: number; // Coulomb constant (e.g. 600)
  springStrength: number; // Hooke spring stiffness (e.g. 0.005)
  springLength: number; // Resting spring length (e.g. 70)
  centering: number; // Pull toward origin (e.g. 0.002)
  damping: number; // Velocity damping per step (e.g. 0.90)
  maxVelocity: number; // Velocity cap (e.g. 8)
}

const DEFAULT_PHYSICS_CONFIG: Physics3DConfig = {
  repulsion: 800,
  springStrength: 0.006,
  springLength: 75,
  centering: 0.003,
  damping: 0.91,
  maxVelocity: 8,
};

/**
 * Advances the 3D force simulation by one time step.
 */
export function step3DPhysics(
  nodes: GraphNode3D[],
  links: ReadonlyArray<GraphLink3D>,
  config: Physics3DConfig = DEFAULT_PHYSICS_CONFIG,
): void {
  const nodeMap = new Map<string, GraphNode3D>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 1. Pairwise Repulsion (Coulomb's Law)
  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    if (!nodeA) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      if (!nodeB) continue;

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dz = nodeB.z - nodeA.z;
      const distSq = dx * dx + dy * dy + dz * dz + 1.0;
      const dist = Math.sqrt(distSq);

      if (dist < 350) {
        const force = config.repulsion / (distSq * dist);
        const fx = dx * force;
        const fy = dy * force;
        const fz = dz * force;

        nodeA.vx -= fx;
        nodeA.vy -= fy;
        nodeA.vz -= fz;
        nodeB.vx += fx;
        nodeB.vy += fy;
        nodeB.vz += fz;
      }
    }
  }

  // 2. Spring Attraction along Links (Hooke's Law)
  for (const link of links) {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dz = target.z - source.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    const displacement = dist - config.springLength;
    const force = displacement * config.springStrength * link.strength;

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    const fz = (dz / dist) * force;

    source.vx += fx;
    source.vy += fy;
    source.vz += fz;
    target.vx -= fx;
    target.vy -= fy;
    target.vz -= fz;
  }

  // 3. Centering force & integration
  for (const node of nodes) {
    node.vx -= node.x * config.centering;
    node.vy -= node.y * config.centering;
    node.vz -= node.z * config.centering;

    // Apply damping
    node.vx *= config.damping;
    node.vy *= config.damping;
    node.vz *= config.damping;

    // Velocity clamp
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy + node.vz * node.vz);
    if (speed > config.maxVelocity) {
      node.vx = (node.vx / speed) * config.maxVelocity;
      node.vy = (node.vy / speed) * config.maxVelocity;
      node.vz = (node.vz / speed) * config.maxVelocity;
    }

    node.x += node.vx;
    node.y += node.vy;
    node.z += node.vz;
  }
}

/**
 * Projects a 3D coordinate point onto a 2D screen viewport given a spherical camera.
 */
export function project3DTo2D(
  point: { x: number; y: number; z: number },
  camera: Camera3D,
  viewport: { width: number; height: number },
): ProjectedPoint {
  // Translate relative to camera target
  const relX = point.x - camera.targetX;
  const relY = point.y - camera.targetY;
  const relZ = point.z - camera.targetZ;

  // 1. Azimuth rotation around Y axis (theta)
  const cosT = Math.cos(camera.theta);
  const sinT = Math.sin(camera.theta);
  const x1 = relX * cosT - relZ * sinT;
  const z1 = relX * sinT + relZ * cosT;

  // 2. Elevation rotation around X axis (phi)
  const cosP = Math.cos(camera.phi);
  const sinP = Math.sin(camera.phi);
  const y2 = relY * cosP - z1 * sinP;
  const z2 = relY * sinP + z1 * cosP;

  // 3. Camera distance translation
  const camZ = z2 + camera.radius;

  if (camZ <= 10) {
    return { screenX: 0, screenY: 0, depth: camZ, scale: 0, visible: false };
  }

  const scale = camera.fov / camZ;
  const screenX = viewport.width / 2 + x1 * scale;
  const screenY = viewport.height / 2 + y2 * scale;

  const visible =
    screenX >= -100 &&
    screenX <= viewport.width + 100 &&
    screenY >= -100 &&
    screenY <= viewport.height + 100;

  return { screenX, screenY, depth: camZ, scale, visible };
}

/**
 * Starter notes that show how the vault and the note map work.
 */
export const STARTER_VAULT_NOTES: ReadonlyArray<VaultNote> = [
  {
    id: "how-leonidas-works",
    title: "How Leonidas works",
    path: ".leonidas/vault/how-leonidas-works.md",
    tags: ["start", "overview"],
    outgoingLinks: ["chat-speed", "model-access", "note-map", "helpers"],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    content: `# How Leonidas works

Leonidas lets AI work on your computer and on your projects.

## What to read next
- [[Chat speed]]: How fast the AI writes its reply.
- [[Model access]]: How you reach more AI models.
- [[Note map]]: A picture of how your notes link to each other.
- [[Helpers]]: Extra AIs that work at the same time.

#start #overview
`,
  },
  {
    id: "chat-speed",
    title: "Chat speed",
    path: ".leonidas/vault/chat-speed.md",
    tags: ["speed", "chat"],
    outgoingLinks: ["how-leonidas-works", "model-access"],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    content: `# Chat speed

Leonidas shows how fast the AI writes while it works. It looks at the last 5, 10 and 20 replies.

- A high number means a fast reply
- A low number means a slow reply
- A model can be fast on one reply and slow on the next

See also [[How Leonidas works]] and [[Model access]].

#speed #chat
`,
  },
  {
    id: "obsidian-migration",
    title: "Move from Obsidian",
    path: ".leonidas/vault/obsidian-migration.md",
    tags: ["vault", "notes", "markdown"],
    outgoingLinks: ["note-map", "how-leonidas-works"],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    content: `# Move from Obsidian

You can bring your Obsidian notes into the Leonidas Vault.

The vault understands:
- Links between notes: \`[[Note Title]]\` and \`[[Note Title|Alias]]\`
- Tags at the top of a note and \`#tags\` inside it
- Lists of notes that link to a note
- A live picture of your notes on the [[Note map]]

#vault #notes #markdown
`,
  },
  {
    id: "helpers",
    title: "Helpers",
    path: ".leonidas/vault/helpers.md",
    tags: ["helpers", "teamwork"],
    outgoingLinks: ["how-leonidas-works", "chat-speed"],
    updatedAt: Date.now(),
    createdAt: Date.now(),
    content: `# Helpers

A helper is a second AI that does one part of the work for your chat. Many helpers can work at the same time.

Helpers can:
- Research a question for you
- Run tests and builds
- Finish a task in the background and tell you when it is done
- Show how fast they work in [[Chat speed]]

#helpers #teamwork
`,
  },
];
