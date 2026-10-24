import { Link } from "@tanstack/react-router";
import { MegaphoneIcon } from "lucide-react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ACT_LABEL, CHANNEL_LABEL } from "./marketing.logic";
import { isUnused, useMarketing } from "./state";

const SHOWN = 3;

/** Command Center home card: how many posts wait for a yes, with the first few. */
export function NeedsApprovalCard() {
  const { list } = useMarketing();
  // No folder, no marketing files, or a failed read: show nothing, so the home page stays quiet.
  if (list === null || isUnused(list)) return null;
  const queue = list?.queue ?? [];
  const total = list?.queueTotal ?? 0;
  return (
    <section
      aria-labelledby="marketing-card-title"
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <h2 id="marketing-card-title" className="flex items-center gap-2 text-sm font-medium">
        <MegaphoneIcon aria-hidden className="size-4 text-muted-foreground" />
        Marketing: needs approval
        {total > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
                  {total}
                </span>
              }
            />
            <TooltipPopup>{`${total} ${total === 1 ? "post waits" : "posts wait"} for your approval`}</TooltipPopup>
          </Tooltip>
        ) : null}
      </h2>
      {list === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          Marketing numbers are not available now. Try again later.
        </p>
      ) : queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing waits for you.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {queue.slice(0, SHOWN).map(({ ticket, post }) => (
            <li key={ticket.id} className="flex flex-col gap-0.5 py-1.5 text-sm">
              <span className="text-xs text-muted-foreground">
                {ACT_LABEL[ticket.act]} on {CHANNEL_LABEL[post.channel]} for {post.brand}
              </span>
              <span className="line-clamp-2">{post.text}</span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/marketing"
        className="w-fit rounded-sm text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {total > SHOWN ? `Open Marketing (${total - SHOWN} more)` : "Open Marketing"}
      </Link>
    </section>
  );
}
