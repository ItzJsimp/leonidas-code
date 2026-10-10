import { describe, expect, it } from "vite-plus/test";
import {
  extractWikiLinks,
  extractTags,
  normalizeNoteId,
  parseVaultNote,
  buildGraphDataFromNotes,
  step3DPhysics,
  project3DTo2D,
  type Camera3D,
  type VaultNote,
} from "./LeonidasVault.logic.ts";

describe("LeonidasVault.logic", () => {
  describe("extractWikiLinks", () => {
    it("extracts simple wiki links", () => {
      const text = "Check out [[Architecture]] and [[System Design]] in the project.";
      const links = extractWikiLinks(text);
      expect(links).toEqual([{ target: "Architecture" }, { target: "System Design" }]);
    });

    it("extracts aliased wiki links", () => {
      const text = "See [[Neural Engine|The Engine]] for more details.";
      const links = extractWikiLinks(text);
      expect(links).toEqual([{ target: "Neural Engine", alias: "The Engine" }]);
    });

    it("extracts wiki links with section anchors", () => {
      const text = "Read [[Agent#Velocity]] to learn more.";
      const links = extractWikiLinks(text);
      expect(links).toEqual([{ target: "Agent" }]);
    });
  });

  describe("extractTags", () => {
    it("extracts inline tags while ignoring code blocks", () => {
      const text = `
        Working with #react and #typescript.
        \`\`\`
        #not-a-tag in code
        \`\`\`
        Also \`#not-inline-code\` but yes #graph.
      `;
      const tags = extractTags(text);
      expect(tags).toEqual(["graph", "react", "typescript"]);
    });

    it("extracts frontmatter array tags", () => {
      const text = `---
title: My Note
tags: [aios, openrouter, speed]
---
# Main Header
Content here.`;
      const tags = extractTags(text);
      expect(tags).toEqual(["aios", "openrouter", "speed"]);
    });

    it("extracts frontmatter bulleted tags", () => {
      const text = `---
title: Bulleted
tags:
  - alpha
  - beta
---
Content.`;
      const tags = extractTags(text);
      expect(tags).toEqual(["alpha", "beta"]);
    });
  });

  describe("parseVaultNote", () => {
    it("parses title, id, tags, and outgoing links from markdown", () => {
      const content = `---
title: Agent Velocity
tags: [perf, metrics]
---
Link to [[OpenRouter Driver]] and #speed.
`;
      const note = parseVaultNote("notes/agent-velocity.md", content);
      expect(note.title).toBe("Agent Velocity");
      expect(note.id).toBe("agent-velocity");
      expect(note.tags).toContain("perf");
      expect(note.tags).toContain("metrics");
      expect(note.tags).toContain("speed");
      expect(note.outgoingLinks).toEqual(["openrouter-driver"]);
    });
  });

  describe("buildGraphDataFromNotes", () => {
    it("constructs 3D nodes, links, and backlinks correctly", () => {
      const notes: VaultNote[] = [
        {
          id: "note-a",
          title: "Note A",
          content: "Links to [[Note B]]",
          path: "note-a.md",
          tags: ["core"],
          outgoingLinks: ["note-b"],
          updatedAt: 1,
          createdAt: 1,
        },
        {
          id: "note-b",
          title: "Note B",
          content: "Backlinks to [[Note A]]",
          path: "note-b.md",
          tags: ["core", "ui"],
          outgoingLinks: ["note-a"],
          updatedAt: 1,
          createdAt: 1,
        },
      ];

      const graph = buildGraphDataFromNotes(notes, { includeTags: true });
      expect(graph.nodes.length).toBeGreaterThanOrEqual(2);

      // Verify node links
      const nodeA = graph.nodes.find((n) => n.id === "note-a");
      const nodeB = graph.nodes.find((n) => n.id === "note-b");
      expect(nodeA).toBeDefined();
      expect(nodeB).toBeDefined();
      expect(nodeA?.outDegree).toBe(1);
      expect(nodeA?.inDegree).toBe(1);

      // Verify backlinks
      expect(graph.backlinksByNoteId["note-b"]).toEqual([{ sourceId: "note-a", title: "Note A" }]);
      expect(graph.backlinksByNoteId["note-a"]).toEqual([{ sourceId: "note-b", title: "Note B" }]);

      // Verify tag nodes
      const tagCore = graph.nodes.find((n) => n.id === "tag:core");
      expect(tagCore).toBeDefined();
      expect(tagCore?.kind).toBe("tag");
    });
  });

  describe("step3DPhysics", () => {
    it("updates positions without NaN or infinite values", () => {
      const notes: VaultNote[] = [
        {
          id: "1",
          title: "1",
          content: "[[2]]",
          path: "1.md",
          tags: [],
          outgoingLinks: ["2"],
          updatedAt: 1,
          createdAt: 1,
        },
        {
          id: "2",
          title: "2",
          content: "",
          path: "2.md",
          tags: [],
          outgoingLinks: [],
          updatedAt: 1,
          createdAt: 1,
        },
      ];

      const graph = buildGraphDataFromNotes(notes, { includeTags: false });
      const nodesCopy = [...graph.nodes];
      const initialX = nodesCopy[0]!.x;

      step3DPhysics(nodesCopy, graph.links);

      expect(Number.isFinite(nodesCopy[0]!.x)).toBe(true);
      expect(Number.isFinite(nodesCopy[0]!.y)).toBe(true);
      expect(Number.isFinite(nodesCopy[0]!.z)).toBe(true);
    });
  });

  describe("project3DTo2D", () => {
    it("projects points onto screen coordinates based on camera", () => {
      const camera: Camera3D = {
        theta: 0,
        phi: 0,
        radius: 400,
        targetX: 0,
        targetY: 0,
        targetZ: 0,
        fov: 600,
      };

      const viewport = { width: 800, height: 600 };
      const point = { x: 0, y: 0, z: 0 };

      const projected = project3DTo2D(point, camera, viewport);
      expect(projected.visible).toBe(true);
      expect(projected.screenX).toBe(400); // center of width
      expect(projected.screenY).toBe(300); // center of height
      expect(projected.scale).toBeGreaterThan(0);
    });
  });
});
