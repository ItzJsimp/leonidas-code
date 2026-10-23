import { UsersIcon } from "lucide-react";

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";

/** Meetings come after Leonidas 1.0. This tab says so instead of showing a blank page. */
export function ScribeMeetingsTab() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>Meetings are not here yet</EmptyTitle>
        <EmptyDescription>
          Meetings come after Leonidas 1.0. Your Scribe transcripts are in the Transcripts tab.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
