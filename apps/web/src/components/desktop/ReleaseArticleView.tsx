import { useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import { releaseArticleUrl } from "./releaseArticle";
import type { ReleaseHistoryEntry } from "./releaseHistory";

export function ReleaseImage({ src, alt }: { readonly src: string; readonly alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <span className="my-6 block overflow-hidden rounded-xl bg-muted">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="aspect-video w-full object-contain"
        onError={() => setFailed(true)}
      />
      {alt ? <span className="block px-4 py-2 text-xs text-muted-foreground">{alt}</span> : null}
    </span>
  );
}

const ARTICLE_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h2 className="mb-3 mt-8 text-xl font-semibold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-9 border-b border-border pb-3 text-xl font-semibold tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-2 ps-5 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 ps-5">{children}</ol>,
  li: ({ children }) => <li className="break-words ps-1">{children}</li>,
  a: ({ href, children }) =>
    href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ src, alt }) => (
    <ReleaseImage
      key={typeof src === "string" ? src : ""}
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
    />
  ),
};

/** An editorial reader, deliberately separate from chat's interactive Markdown renderer. */
export function ReleaseArticle({ entry }: { readonly entry: ReleaseHistoryEntry }) {
  return (
    <article className="mx-auto max-w-[68ch] text-sm leading-7 text-foreground">
      <ReactMarkdown skipHtml urlTransform={releaseArticleUrl} components={ARTICLE_COMPONENTS}>
        {entry.article.markdown || "No notes were published for this update."}
      </ReactMarkdown>
    </article>
  );
}
