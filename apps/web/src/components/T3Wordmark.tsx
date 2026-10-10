import type { SVGProps } from "react";

// Leonidas helm mark (name kept so upstream merges stay cheap).
export function T3Wordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <image href="/apple-touch-icon.png" width="64" height="64" />
    </svg>
  );
}
