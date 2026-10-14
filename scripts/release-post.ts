// @effect-diagnostics nodeBuiltinImport:off - Release planning runs before dependencies are installed.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

/** Resolve a committed editorial post and pin its local images to this release's source commit. */
export function loadReleasePost(
  root: string,
  file: string,
  repository: string,
  commit: string,
): string {
  if (!/^release-posts\/[a-zA-Z0-9_./-]+\.md$/.test(file) || file.split("/").includes("..")) {
    throw new Error("Release-Post must name a Markdown file inside release-posts/");
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/i.test(commit)) {
    throw new Error("Release posts require a repository and full source commit");
  }
  const post = NodeFS.readFileSync(NodePath.join(root, file), "utf8").trim();
  if (post.length > 60_000 || !/^# [^\n]+\n\n\S/.test(post) || post.includes("\u2014")) {
    throw new Error(
      "Release post needs a title, introduction, at most 60000 characters, and plain punctuation",
    );
  }
  return post.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, (_, alt: string, source: string) => {
    if (!alt.trim()) throw new Error("Release images need descriptive alt text");
    if (source.startsWith("https://")) return `![${alt}](${source})`;
    const image = NodePath.posix.normalize(
      NodePath.posix.join(NodePath.posix.dirname(file), source),
    );
    if (!image.startsWith("release-posts/") || !/\.(png|jpe?g|webp|avif)$/i.test(image)) {
      throw new Error("Release images must be HTTPS URLs or raster files inside release-posts/");
    }
    const size = NodeFS.statSync(NodePath.join(root, image)).size;
    if (size > 2_000_000) throw new Error("Release image exceeds the 2 MB budget");
    const url = `https://raw.githubusercontent.com/${repository}/${commit}/${image.split("/").map(encodeURIComponent).join("/")}`;
    return `![${alt}](${url})`;
  });
}
