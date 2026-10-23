import { APPROVAL_LABEL, CHANNEL_LABEL, type ContentRow, formatCount } from "./marketing.logic";

/** Every draft and posted item, newest first, with its latest numbers when it has any. */
export function ContentList(props: {
  readonly rows: ReadonlyArray<ContentRow>;
  readonly total: number;
}) {
  if (props.rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No drafts or posts yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {props.rows.map(({ post, approval, latest }) => (
          <li key={post.id} className="flex flex-col gap-1 p-3">
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{CHANNEL_LABEL[post.channel]}</span>
              <span>{post.brand}</span>
              <span className="font-medium text-foreground">
                {post.status === "posted" ? "Posted" : "Draft"}
              </span>
              {post.status === "draft" ? <span>{APPROVAL_LABEL[approval]}</span> : null}
            </span>
            <span className="line-clamp-3 whitespace-pre-wrap break-words text-sm">
              {post.text}
            </span>
            {latest ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCount(latest.impressions)} seen · {formatCount(latest.likes)} likes ·{" "}
                {formatCount(latest.replies)} replies · {formatCount(latest.reposts)} reposts
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {props.total > props.rows.length ? (
        <p role="status" className="text-sm text-muted-foreground">
          Showing the newest {props.rows.length} of {props.total}.
        </p>
      ) : null}
    </div>
  );
}
