import type { MarketingDecideResult, MarketingListResult } from "@t3tools/contracts";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";
import {
  ACT_LABEL,
  buildDecisions,
  CHANNEL_LABEL,
  formatUsd,
  groupQueueByBrand,
  summarizeResults,
} from "./marketing.logic";

export type DecideFn = (
  decisions: ReadonlyArray<{ ticketId: string; decision: "approve" | "reject" }>,
) => Promise<ReadonlyArray<MarketingDecideResult> | null>;

/**
 * The batch approval screen. A person picks items and approves or rejects them in one pass.
 * The server still checks and signs each ticket alone.
 */
export function BatchApproval(props: {
  readonly queue: MarketingListResult["queue"];
  readonly queueTotal: number;
  readonly canDecide: boolean;
  readonly decide: DecideFn;
  readonly onDecided: () => void;
}) {
  const { queue, canDecide } = props;
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeResults> | null>(null);
  const [failedToSend, setFailedToSend] = useState(false);

  const chosen = queue.filter(({ ticket }) => selected.has(ticket.id));
  const cost = chosen.reduce((sum, { ticket }) => sum + ticket.costEstimateUsd, 0);
  const allSelected = queue.length > 0 && chosen.length === queue.length;

  const toggle = (id: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  async function send(decision: "approve" | "reject") {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    setFailedToSend(false);
    try {
      const results = await props.decide(buildDecisions(queue, selected, decision));
      if (results === null) {
        setFailedToSend(true);
        return;
      }
      setSummary(summarizeResults(results));
      setSelected(new Set());
      props.onDecided();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        An approval lets one exact text go out. Nothing is posted from this screen. If a text
        changes after you approve it, the approval no longer counts.
      </p>

      {summary ? (
        <div role="status" className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{summary.line}</p>
          {summary.failed.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {summary.failed.map((item) => (
                <li key={item.ticketId}>{item.text}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {failedToSend ? (
        <p role="alert" className="text-sm text-destructive">
          The decision was not saved. Nothing changed. Try again.
        </p>
      ) : null}

      {queue.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing waits for you. Agents add drafts here when they ask.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allSelected}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(queue.map((i) => i.ticket.id)))
                }
              />
              Select all ({queue.length})
            </label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {chosen.length} selected, cost if approved {formatUsd(cost)}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="destructive-outline"
                disabled={!canDecide || busy || chosen.length === 0}
                title="Reject the selected items. The agent can write a new draft."
                onClick={() => void send("reject")}
              >
                <XIcon aria-hidden />
                Reject ({chosen.length})
              </Button>
              <Button
                size="sm"
                disabled={!canDecide || busy || chosen.length === 0}
                title="Approve the selected items. Each one is signed on its own."
                onClick={() => void send("approve")}
              >
                <CheckIcon aria-hidden />
                Approve ({chosen.length})
              </Button>
            </div>
          </div>
          {props.queueTotal > queue.length ? (
            <p role="status" className="text-sm text-muted-foreground">
              Showing the oldest {queue.length} of {props.queueTotal}. The rest appear after you
              decide these.
            </p>
          ) : null}
          {canDecide ? null : (
            <p role="status" className="text-sm text-muted-foreground">
              Only a signed-in person can approve here. This session can only look.
            </p>
          )}
          {groupQueueByBrand(queue).map(({ brand, items }) => (
            <section key={brand} aria-label={brand} className="flex flex-col gap-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {brand}
              </h3>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {items.map(({ ticket, post }) => (
                  <li key={ticket.id}>
                    <label className="flex cursor-pointer items-start gap-3 p-3">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                        checked={selected.has(ticket.id)}
                        onChange={() => toggle(ticket.id)}
                        aria-label={`Select: ${post.text.slice(0, 60)}`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {ACT_LABEL[ticket.act]} on {CHANNEL_LABEL[post.channel]} · asked by{" "}
                          {ticket.requestedBy.name} · cost {formatUsd(ticket.costEstimateUsd)}
                        </span>
                        <span className="whitespace-pre-wrap break-words text-sm">{post.text}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
