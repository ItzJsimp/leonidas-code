import { JevClientProtocol } from "./typesafeClient.js";

export interface NoteChunk {
  source: string;
  text: string;
}

export interface NotesSelectionResult {
  keptNotes: NoteChunk[];
  droppedNotes: Array<{ source: string; prob: number; reason: string }>;
  initialTokens: number;
  finalTokens: number;
  tokensSaved: number;
  percentReduction: number;
}

export function chunkNotes(markdown: string, source: string): NoteChunk[] {
  const parts = markdown.split(/\n(?=## )/g);
  return parts.map((p) => ({ source, text: p.trim() })).filter((p) => p.text.length > 0);
}

export async function pickNotes(
  task: string,
  notes: NoteChunk[],
  client: JevClientProtocol,
  alwaysNotes: NoteChunk[] = [],
  keep = 6,
  floor = 0.55,
): Promise<NotesSelectionResult> {
  const allInitial = [...alwaysNotes, ...notes];
  const initialText = allInitial.map((n) => n.text).join("\n");
  const initialTokens = Math.max(1, Math.floor(initialText.length / 4));

  if (!notes.length) {
    const finalTokens = Math.max(
      1,
      Math.floor(alwaysNotes.map((n) => n.text).join("\n").length / 4),
    );
    return {
      keptNotes: alwaysNotes,
      droppedNotes: [],
      initialTokens,
      finalTokens,
      tokensSaved: initialTokens - finalTokens,
      percentReduction: 0,
    };
  }

  // Score chunks in parallel
  const scored = await Promise.all(
    notes.map(async (note) => {
      const context = `TASK:\n${task}\n\nNOTE (${note.source}):\n${note.text}`;
      const probs = await client.choice(
        context,
        "Would an engineer need this note to do the task correctly?",
        ["needed", "not_needed"],
      );
      return { note, prob: probs["needed"] ?? 0 };
    }),
  );

  scored.sort((a, b) => b.prob - a.prob);

  let picked = scored.slice(0, keep).filter((s) => s.prob >= floor);
  if (picked.length === 0 && scored.length > 0) {
    picked = scored.slice(0, 2); // Fallback top 2
  }

  const pickedSet = new Set(picked.map((p) => p.note));
  const droppedNotes: Array<{ source: string; prob: number; reason: string }> = [];

  for (const s of scored) {
    if (!pickedSet.has(s.note)) {
      droppedNotes.push({
        source: s.note.source,
        prob: s.prob,
        reason: s.prob < floor ? `Prob ${s.prob} < floor ${floor}` : `Exceeded keep ${keep}`,
      });
    }
  }

  const keptNotes = [...alwaysNotes, ...picked.map((p) => p.note)];
  const finalText = keptNotes.map((n) => n.text).join("\n");
  const finalTokens = Math.max(1, Math.floor(finalText.length / 4));
  const tokensSaved = Math.max(0, initialTokens - finalTokens);
  const percentReduction = Number(((tokensSaved / initialTokens) * 100).toFixed(1));

  return {
    keptNotes,
    droppedNotes,
    initialTokens,
    finalTokens,
    tokensSaved,
    percentReduction,
  };
}
