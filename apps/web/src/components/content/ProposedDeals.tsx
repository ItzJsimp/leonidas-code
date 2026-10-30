import type { ContentProposal } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

import { formatDue } from "./content.logic";

/** The deal, or the server's own words when it refused. `null` means it worked. */
export type DecideDealFn = (
  slug: string,
  decision: "confirm" | "dismiss",
) => Promise<string | null>;

/**
 * Deals an agent found. They are not deals yet: one tap on Confirm makes the deal folder.
 * Only a person who may write sees the buttons.
 */
export function ProposedDeals(props: {
  readonly proposals: readonly ContentProposal[];
  readonly canAct: boolean;
  readonly busy: boolean;
  readonly onDecide: (proposal: ContentProposal, decision: "confirm" | "dismiss") => void;
}) {
  return (
    <section aria-label="Proposed deals" className="rounded-xl border bg-muted/40">
      <header className="flex items-center gap-2 px-3 py-2">
        <h2 className="font-medium text-sm">Proposed deals</h2>
        <Badge size="sm" variant="secondary">
          {props.proposals.length}
        </Badge>
      </header>
      <ul className="flex flex-col gap-2 p-2 pt-0">
        {props.proposals.map((proposal) => (
          <li
            key={proposal.slug}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{proposal.brand}</p>
              <p className="text-muted-foreground text-xs">
                {[
                  `Found by ${proposal.proposedBy}`,
                  proposal.source,
                  proposal.deadline ? `due ${formatDue(proposal.deadline)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {proposal.terms ? (
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-muted-foreground text-xs">
                  {proposal.terms}
                </p>
              ) : null}
            </div>
            {props.canAct ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={props.busy}
                  onClick={() => props.onDecide(proposal, "confirm")}
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={props.busy}
                  onClick={() => props.onDecide(proposal, "dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
