import { splitTourMarker } from "../../features/tour/tourTargets";

const HIGHLIGHT_COUNT = 5;

/** Read-only notes shared by update history and the downloaded-update dialog. */
export function ReleaseNoteList({ items }: { readonly items: ReadonlyArray<string> }) {
  const notes = [...new Set(items)];
  const renderNotes = (notes: ReadonlyArray<string>) => (
    <ul className="list-disc space-y-2.5 ps-4 text-sm leading-relaxed marker:text-muted-foreground/50">
      {notes.map((note) => (
        <li key={note} className="break-words ps-1">
          {splitTourMarker(note).text}
        </li>
      ))}
    </ul>
  );

  if (!notes.length) {
    return <p className="text-sm text-muted-foreground">No patch notes were published.</p>;
  }

  return (
    <div className="space-y-4">
      {renderNotes(notes.slice(0, HIGHLIGHT_COUNT))}
      {notes.length > HIGHLIGHT_COUNT ? (
        <details className="group">
          <summary className="w-fit cursor-pointer rounded-sm text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
            <span className="group-open:hidden">
              Show {notes.length - HIGHLIGHT_COUNT} more changes
            </span>
            <span className="hidden group-open:inline">Show fewer changes</span>
          </summary>
          <div className="pt-3">{renderNotes(notes.slice(HIGHLIGHT_COUNT))}</div>
        </details>
      ) : null}
    </div>
  );
}
