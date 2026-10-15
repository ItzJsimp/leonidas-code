import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Network,
  Edit3,
  Eye,
  Trash2,
  Tag,
  Link as LinkIcon,
  Search,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  type VaultNote,
  STARTER_VAULT_NOTES,
  parseVaultNote,
  buildGraphDataFromNotes,
  normalizeNoteId,
} from "./LeonidasVault.logic.ts";
import { LeonidasKnowledgeGraph3D } from "./LeonidasKnowledgeGraph3D.tsx";

const VAULT_STORAGE_KEY = "leonidas-vault-notes";

export interface LeonidasVaultPanelProps {
  readonly initialView?: "vault" | "graph";
  readonly className?: string;
}

export function LeonidasVaultPanel({
  initialView = "vault",
  className = "",
}: LeonidasVaultPanelProps) {
  // Load notes from local storage or starter notes
  const [notes, setNotes] = useState<VaultNote[]>(() => {
    try {
      const saved = localStorage.getItem(VAULT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return [...STARTER_VAULT_NOTES];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    return notes[0]?.id ?? "leonidas-aios-architecture";
  });

  const [viewMode, setViewMode] = useState<"editor" | "graph" | "split">(
    initialView === "graph" ? "graph" : "split",
  );
  const [editorPreview, setEditorPreview] = useState<"edit" | "preview">("edit");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Save notes to storage on change
  useEffect(() => {
    try {
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null;
  }, [notes, activeNoteId]);

  // Compute 3D Graph Data
  const graphData = useMemo(() => {
    return buildGraphDataFromNotes(notes, { includeTags: true });
  }, [notes]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    notes.forEach((note) => note.tags.forEach((t) => tagsSet.add(t)));
    return Array.from(tagsSet).sort();
  }, [notes]);

  // Filtered notes list
  const filteredNotes = useMemo(() => {
    const query = searchFilter.toLowerCase().trim();
    return notes.filter((note) => {
      if (selectedTag && !note.tags.includes(selectedTag)) return false;
      if (!query) return true;
      return (
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query) ||
        note.tags.some((t) => t.toLowerCase().includes(query))
      );
    });
  }, [notes, searchFilter, selectedTag]);

  // Handle note content editing
  const handleUpdateContent = (newContent: string) => {
    if (!activeNote) return;
    const updated = parseVaultNote(activeNote.path, newContent);
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? {
              ...n,
              content: newContent,
              title: updated.title,
              tags: updated.tags,
              outgoingLinks: updated.outgoingLinks,
              updatedAt: Date.now(),
            }
          : n,
      ),
    );
  };

  const handleUpdateTitle = (newTitle: string) => {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id ? { ...n, title: newTitle, updatedAt: Date.now() } : n,
      ),
    );
  };

  const handleCreateNote = () => {
    const timestamp = Date.now();
    const newTitle = `Untitled Note ${notes.length + 1}`;
    const newId = normalizeNoteId(newTitle);
    const newPath = `.leonidas/vault/${newId}.md`;
    const newContent = `# ${newTitle}\n\nWrite your note here. Link to another note with [[Note Title]]. Add a #tag to group notes.`;
    const newNote = parseVaultNote(newPath, newContent);

    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setViewMode("editor");
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (activeNoteId === id && remaining.length > 0) {
        setActiveNoteId(remaining[0]!.id);
      }
      return remaining;
    });
  };

  // Backlinks for active note
  const activeBacklinks = useMemo(() => {
    if (!activeNote) return [];
    return graphData.backlinksByNoteId[activeNote.id] ?? [];
  }, [activeNote, graphData.backlinksByNoteId]);

  return (
    <div className={`flex h-full w-full bg-[#0a0d14] text-slate-200 overflow-hidden ${className}`}>
      {/* Left Sidebar: Notes Navigator & Tags */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800/80 bg-[#0d111a]">
        {/* Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-xs tracking-wider uppercase text-slate-100">
              Leonidas Vault
            </span>
          </div>
          <button
            type="button"
            onClick={handleCreateNote}
            className="flex items-center gap-1 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs transition"
            title="Add a note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New note</span>
          </button>
        </div>

        {/* Search & Tag Filter */}
        <div className="p-2 border-b border-slate-800/60 space-y-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-slate-900/80 border border-slate-800 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes…"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-transparent text-gray-200 placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Tags scroll bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded transition ${
                selectedTag === null
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded whitespace-nowrap transition ${
                  selectedTag === tag
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {filteredNotes.map((note) => {
            const isActive = activeNote?.id === note.id;
            return (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveNoteId(note.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveNoteId(note.id);
                  }
                }}
                className={`group flex items-start justify-between p-2 rounded cursor-pointer transition text-xs ${
                  isActive
                    ? "bg-cyan-950/40 text-cyan-200 border-l-2 border-cyan-400"
                    : "hover:bg-slate-800/40 text-slate-300"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <FileText
                      className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500"}`}
                    />
                    <span className="truncate">{note.title}</span>
                  </div>
                  {note.tags.length > 0 && (
                    <div className="flex gap-1 mt-1 truncate">
                      {note.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] text-purple-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition"
                  title="Delete note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* View Switcher Bar at Bottom */}
        <div className="p-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-around text-xs">
          <button
            type="button"
            onClick={() => setViewMode("editor")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              viewMode === "editor"
                ? "bg-cyan-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Note</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              viewMode === "split"
                ? "bg-cyan-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("graph")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition ${
              viewMode === "graph"
                ? "bg-cyan-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Note map</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Pane (visible in editor or split mode) */}
        {(viewMode === "editor" || viewMode === "split") && activeNote && (
          <div className="flex-1 flex flex-col border-r border-slate-800/80 overflow-hidden bg-[#0c0f17]">
            {/* Editor Toolbar */}
            <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleUpdateTitle(e.target.value)}
                className="bg-transparent text-base font-bold text-slate-100 focus:outline-none focus:border-b border-cyan-500 w-2/3"
                placeholder="Note title"
              />

              <div className="flex items-center gap-1 bg-slate-900 rounded p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setEditorPreview("edit")}
                  className={`px-2 py-0.5 rounded transition ${
                    editorPreview === "edit"
                      ? "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setEditorPreview("preview")}
                  className={`px-2 py-0.5 rounded transition ${
                    editorPreview === "preview"
                      ? "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Preview
                </button>
              </div>
            </div>

            {/* Note Tags & Links metadata bar */}
            <div className="px-4 py-2 bg-slate-900/30 border-b border-slate-800/40 flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-purple-400" />
                <span>Tags:</span>
                {activeNote.tags.length > 0 ? (
                  activeNote.tags.map((t) => (
                    <span key={t} className="text-purple-300 font-mono text-[11px]">
                      #{t}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-600">none</span>
                )}
              </div>

              <div className="w-[1px] h-3 bg-slate-700" />

              <div className="flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-cyan-400" />
                <span>Links to other notes ({activeNote.outgoingLinks.length}):</span>
                {activeNote.outgoingLinks.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => setActiveNoteId(target)}
                    className="text-cyan-400 hover:underline font-mono text-[11px]"
                  >
                    [[{target}]]
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea or Preview */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed">
              {editorPreview === "edit" ? (
                <textarea
                  value={activeNote.content}
                  onChange={(e) => handleUpdateContent(e.target.value)}
                  placeholder="Type your note. Use [[Note Title]] to link to another note. Use #tags to group notes."
                  className="w-full h-full bg-transparent text-slate-200 resize-none focus:outline-none placeholder-slate-600 font-sans text-sm leading-relaxed"
                />
              ) : (
                <div className="prose prose-invert max-w-none text-slate-300 font-sans">
                  <div className="whitespace-pre-wrap">{activeNote.content}</div>
                </div>
              )}
            </div>

            {/* Backlinks Pane at Bottom */}
            <div className="p-3 border-t border-slate-800 bg-[#090c12]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
                <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Notes that link here ({activeBacklinks.length})</span>
              </div>
              {activeBacklinks.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeBacklinks.map((link) => (
                    <button
                      key={link.sourceId}
                      type="button"
                      onClick={() => setActiveNoteId(link.sourceId)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 text-xs text-cyan-300 transition"
                    >
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                      <span>{link.title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  No notes link to this note yet. Add [[this note title]] in another note to link
                  it.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3D Knowledge Graph (visible in graph or split mode) */}
        {(viewMode === "graph" || viewMode === "split") && (
          <div className="flex-1 relative h-full">
            <LeonidasKnowledgeGraph3D
              graphData={graphData}
              selectedNodeId={activeNote?.id ?? null}
              onSelectNode={(nodeId) => {
                const cleanId = nodeId.startsWith("tag:") ? nodeId.replace("tag:", "") : nodeId;
                if (notes.some((n) => n.id === cleanId)) {
                  setActiveNoteId(cleanId);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
