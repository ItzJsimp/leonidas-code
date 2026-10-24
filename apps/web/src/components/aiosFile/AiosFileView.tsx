import { ExternalLinkIcon } from "lucide-react";
import { lazy, Suspense, useMemo } from "react";

import { Button } from "~/components/ui/button";
import { MiddleTruncate } from "~/components/ui/middle-truncate";
import { useActiveAiosWorkspace } from "~/components/workspace/useActiveAiosWorkspace";
import { projectEnvironment } from "~/state/projects";
import { useEnvironmentQuery } from "~/state/query";

import { WindowError, WindowLoading } from "../twoState/RailWindow";
import { withoutFrontmatter } from "./aiosFile.logic";
import { useOpenAiosFile } from "./useOpenAiosFile";

const ChatMarkdown = lazy(() => import("~/components/ChatMarkdown"));

/**
 * One AIOS markdown file, read in place: its path, an "Open file" button that opens it in the
 * user's editor, and the rendered text without frontmatter. `path` is AIOS-relative.
 */
export function AiosFileView({
  path,
  className,
}: {
  readonly path: string;
  readonly className?: string;
}) {
  const { environmentId } = useActiveAiosWorkspace();
  const { open, root } = useOpenAiosFile();
  const file = useEnvironmentQuery(
    environmentId && root
      ? projectEnvironment.readFile({ environmentId, input: { cwd: root, relativePath: path } })
      : null,
  );
  const text = useMemo(
    () => (file.data ? withoutFrontmatter(file.data.contents) : null),
    [file.data],
  );
  return (
    <article className={className}>
      <div className="flex min-w-0 items-center gap-2 border-b border-border pb-2">
        <span className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
          <MiddleTruncate value={path} />
        </span>
        <Button size="xs" variant="outline" onClick={() => void open(path)}>
          <ExternalLinkIcon aria-hidden />
          Open file
        </Button>
      </div>
      {text !== null ? (
        <Suspense fallback={<WindowLoading label="Showing the note" />}>
          <ChatMarkdown
            text={text}
            cwd={root ?? undefined}
            environmentId={environmentId ?? undefined}
            className="pt-3 text-sm"
          />
          {file.data?.truncated ? (
            <p className="pt-2 text-xs text-muted-foreground">
              This note is long. Open the file to read the rest.
            </p>
          ) : null}
        </Suspense>
      ) : file.error !== null ? (
        <div className="pt-3">
          <WindowError message={`${path} did not load.`} onRetry={file.refresh} />
        </div>
      ) : (
        <WindowLoading label="Reading the note" />
      )}
    </article>
  );
}
