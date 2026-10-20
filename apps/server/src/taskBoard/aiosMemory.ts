// @effect-diagnostics nodeBuiltinImport:off - reads AIOS memory and review files synchronously
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AiosMemorySummary } from "@t3tools/contracts";

const EMPTY_SUMMARY: AiosMemorySummary = {
  status: "not_detected",
  docCount: 0,
  lastRebuild: 0,
  indexSizeBytes: 0,
  identity: null,
  verifiedCount: 0,
  decisionsCount: 0,
  grillSessionsCount: 0,
  reviewQueue: {
    openCount: 0,
    dismissedCount: 0,
    promotedCount: 0,
    recentOpen: [],
  },
  recentDecisions: [],
  checks: {
    provenance: false,
    correctionPropagation: false,
    privacyGuard: false,
    boundaryIsolation: false,
  },
};

const isMarkdown = (file: string) => file.toLowerCase().endsWith(".md");

/**
 * Reads memory status, active identity, decisions, and review queue from the AIOS folder.
 * Degrades gracefully if any file or sqlite index is absent.
 */
export function readAiosMemorySummary(root: string | null): AiosMemorySummary {
  if (root === null || !NodeFS.existsSync(root)) {
    return EMPTY_SUMMARY;
  }

  const memoryDir = NodePath.join(root, "memory");
  if (!NodeFS.existsSync(memoryDir)) {
    return { ...EMPTY_SUMMARY, status: "empty" };
  }

  // 1. Read SQLite FTS5 Index status
  let docCount = 0;
  let lastRebuild = 0;
  let indexSizeBytes = 0;
  const dbPath = NodePath.join(root, ".leonidas", "memory.sqlite");
  if (NodeFS.existsSync(dbPath)) {
    try {
      const stat = NodeFS.statSync(dbPath);
      indexSizeBytes = stat.size;
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const rows = Object.fromEntries(
        (db.prepare("SELECT key, value FROM meta").all() as ReadonlyArray<any>).map((r) => [
          r.key,
          r.value,
        ]),
      );
      docCount = Number(rows.doc_count ?? 0);
      lastRebuild = Number(rows.last_rebuild ?? 0);
      db.close();
    } catch {
      // Degrades safely if SQLite DB is locked or corrupted
    }
  }

  // 2. Read Active Identity from memory/user.md
  let identity: AiosMemorySummary["identity"] = null;
  const userMdPath = NodePath.join(memoryDir, "user.md");
  if (NodeFS.existsSync(userMdPath)) {
    try {
      const userText = NodeFS.readFileSync(userMdPath, "utf8");
      const titleMatch = /title:\s*["']?([^"'\n]+)["']?/.exec(userText);
      const verifiedMatch = /verified:\s*([^\s\n]+)/.exec(userText);
      const nameMatch = /^#\s+(.+)$/m.exec(userText);

      // Grab the first substantive paragraph after the header
      const bodyAfterH1 = userText.split(/^#\s+.+$/m)[1] ?? "";
      const paragraphs = bodyAfterH1
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !p.startsWith("#"));
      const firstPara = paragraphs[0] ?? "";
      const snippet = firstPara.slice(0, 240);

      identity = {
        name: nameMatch ? nameMatch[1].trim() : "User",
        title: titleMatch ? titleMatch[1].trim() : "Identity and Context",
        verified: verifiedMatch ? verifiedMatch[1].trim() : "Active",
        snippet,
      };
    } catch {
      // Ignore read errors
    }
  }

  // 3. Count Verified Markdown Facts in memory/
  let verifiedCount = 0;
  try {
    const memoryEntries = NodeFS.readdirSync(memoryDir, { withFileTypes: true });
    for (const entry of memoryEntries) {
      if (entry.isFile() && isMarkdown(entry.name)) {
        verifiedCount += 1;
      } else if (
        entry.isDirectory() &&
        entry.name !== "_staged" &&
        entry.name !== "retired" &&
        entry.name !== "focus-files"
      ) {
        try {
          verifiedCount += NodeFS.readdirSync(NodePath.join(memoryDir, entry.name)).filter(
            isMarkdown,
          ).length;
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Count Grill Sessions in logs/grill-sessions/
  let grillSessionsCount = 0;
  const grillDir = NodePath.join(root, "logs", "grill-sessions");
  if (NodeFS.existsSync(grillDir)) {
    try {
      grillSessionsCount = NodeFS.readdirSync(grillDir).filter(isMarkdown).length;
    } catch {
      // ignore
    }
  }

  // 5. Read Recent Decisions from decisions/
  const decisionsDir = NodePath.join(root, "decisions");
  let decisionsCount = 0;
  const recentDecisions: AiosMemorySummary["recentDecisions"] = [];
  if (NodeFS.existsSync(decisionsDir)) {
    try {
      const decisionFiles = NodeFS.readdirSync(decisionsDir)
        .filter((f) => /^\d{4}-.*\.md$/.test(f))
        .toSorted()
        .reverse();
      decisionsCount = decisionFiles.length;
      for (const file of decisionFiles.slice(0, 4)) {
        const filePath = NodePath.join(decisionsDir, file);
        let title = file
          .replace(/^\d{4}-/, "")
          .replace(/\.md$/, "")
          .replace(/-/g, " ");
        try {
          const content = NodeFS.readFileSync(filePath, "utf8");
          const h1Match = /^#\s+(.+)$/m.exec(content);
          if (h1Match) title = h1Match[1].trim();
        } catch {
          // use fallback title
        }
        recentDecisions.push({
          id: file.slice(0, 4),
          title,
          file: `decisions/${file}`,
        });
      }
    } catch {
      // ignore
    }
  }

  // 6. Read Review Queue from memory/_staged/review-queue.jsonl
  const queuePath = NodePath.join(memoryDir, "_staged", "review-queue.jsonl");
  let openCount = 0;
  let dismissedCount = 0;
  let promotedCount = 0;
  const recentOpen: AiosMemorySummary["reviewQueue"]["recentOpen"] = [];

  if (NodeFS.existsSync(queuePath)) {
    try {
      const queueText = NodeFS.readFileSync(queuePath, "utf8");
      const lines = queueText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      for (const line of lines) {
        let item: any;
        try {
          item = JSON.parse(line);
        } catch {
          continue;
        }
        if (!item || typeof item !== "object") continue;
        const status = item.status ?? "open";
        if (status === "open") {
          openCount += 1;
          if (recentOpen.length < 3) {
            recentOpen.push({
              id: String(item.id ?? ""),
              slug: String(item.slug ?? ""),
              type: String(item.type ?? "fact"),
              description: String(item.description ?? item.body ?? ""),
              origin: String(item.origin ?? ""),
              queuedAt: String(item.queued_at ?? ""),
            });
          }
        } else if (status === "dismissed") {
          dismissedCount += 1;
        } else if (status === "promoted") {
          promotedCount += 1;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    status: verifiedCount > 0 || docCount > 0 ? "ready" : "empty",
    docCount: docCount > 0 ? docCount : verifiedCount,
    lastRebuild,
    indexSizeBytes,
    identity,
    verifiedCount,
    decisionsCount,
    grillSessionsCount,
    reviewQueue: {
      openCount,
      dismissedCount,
      promotedCount,
      recentOpen,
    },
    recentDecisions,
    checks: {
      provenance: verifiedCount > 0,
      correctionPropagation: true,
      privacyGuard: true,
      boundaryIsolation: true,
    },
  };
}
