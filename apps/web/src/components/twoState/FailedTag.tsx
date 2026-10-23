/** A visible word for a failed event, so a failure never shows by color alone. */
export function FailedTag() {
  return (
    <span className="mr-1.5 rounded-sm border border-destructive/60 px-1 align-middle text-2xs font-medium text-destructive-foreground">
      Failed
    </span>
  );
}
