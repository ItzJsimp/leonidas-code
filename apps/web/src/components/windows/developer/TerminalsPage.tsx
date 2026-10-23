import { TerminalSquareIcon } from "lucide-react";

import { WindowEmpty } from "~/components/twoState/RailWindow";

import { DeveloperStrip } from "./DeveloperStrip";

/** Terminals live inside a chat, so this tab points there. */
export function TerminalsPage() {
  return (
    <section
      aria-label="Developer"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
    >
      <DeveloperStrip />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <WindowEmpty
          icon={TerminalSquareIcon}
          title="No terminals here"
          line="Terminals open inside a chat. Open a chat and use the Show or hide the terminal button in its header."
          action={{ label: "Open a chat", to: "/" }}
        />
      </div>
    </section>
  );
}
