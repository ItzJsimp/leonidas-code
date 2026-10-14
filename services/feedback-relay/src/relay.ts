/**
 * Feedback relay: validates a report from the app and files it as a GitHub Issue in the private
 * feedback repo. Pure over `fetch` and a tiny KV interface so it runs in a Cloudflare Worker and
 * in tests. The GitHub token only ever lives in the Worker's secrets.
 */

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface RelayEnv {
  /** Fine-grained token: Issues and Contents write on the feedback repo only. */
  readonly GITHUB_TOKEN: string;
  /** `owner/name` of the private feedback repo. */
  readonly GITHUB_REPO: string;
  readonly RATE: KvLike;
}

const TYPES = ["bug", "idea", "suggestion"] as const;
type ReportType = (typeof TYPES)[number];

const MAX_BODY_CHARS = 3_000_000;
const MAX_TEXT_CHARS = 4_000;
const MAX_SCREENSHOT_CHARS = 2_000_000;
const PER_INSTALL_PER_MINUTE = 5;
const PER_INSTALL_PER_DAY = 25;
const PER_IP_PER_HOUR = 40;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

interface Report {
  readonly installId: string;
  readonly name: string | null;
  readonly type: ReportType;
  readonly text: string;
  readonly screenshot: { readonly ext: string; readonly base64: string } | null;
  readonly context: Readonly<Record<string, string>>;
}

const CONTEXT_KEYS = [
  "appVersion",
  "platform",
  "route",
  "source",
  "submittedAt",
  "provider",
  "model",
  "lastError",
] as const;

function clip(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** Returns a clean report, or null when the payload is not one of ours. */
export function parseReport(raw: unknown): Report | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const installId = clip(body.installId, 64);
  const text = clip(body.text, MAX_TEXT_CHARS);
  const type = TYPES.find((candidate) => candidate === body.type);
  if (!installId || !/^[0-9a-f-]{8,64}$/i.test(installId) || !text || !type) return null;

  const context: Record<string, string> = {};
  const rawContext = typeof body.context === "object" && body.context ? body.context : {};
  for (const key of CONTEXT_KEYS) {
    const value = clip(
      (rawContext as Record<string, unknown>)[key],
      key === "lastError" ? 500 : 120,
    );
    if (value) context[key] = value;
  }

  let screenshot: Report["screenshot"] = null;
  if (typeof body.screenshot === "string" && body.screenshot.length <= MAX_SCREENSHOT_CHARS) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(body.screenshot);
    if (match?.[1] && match[2]) {
      screenshot = { ext: match[1] === "jpeg" ? "jpg" : match[1], base64: match[2] };
    }
  }
  return { installId, name: clip(body.name, 80), type, text, screenshot, context };
}

/** Stops a report from pinging people or closing issues through GitHub's text features. */
function defang(text: string): string {
  return text.replace(/@/g, "@\u200b");
}

export function buildIssue(report: Report, screenshotUrl: string | null) {
  const firstLine = report.text.split(/\r?\n/, 1)[0] ?? report.text;
  const title = `[${report.type}] ${defang(firstLine).slice(0, 70)}`;
  const rows = Object.entries(report.context).map(
    ([key, value]) => `| ${key} | ${defang(value).replace(/[|\r\n]+/g, " ")} |`,
  );
  const body = [
    defang(report.text),
    ...(screenshotUrl ? ["", `![screenshot](${screenshotUrl})`] : []),
    "",
    "| Context | |",
    "| --- | --- |",
    `| reporter | ${report.name ? defang(report.name).replace(/[|\r\n]+/g, " ") : "anonymous"} |`,
    `| install | ${report.installId.slice(0, 8)} |`,
    ...rows,
    "",
    `<!-- feedback-install:${report.installId} -->`,
  ].join("\n");
  return { title, body, labels: [report.type, "needs-triage"] };
}

async function overLimit(
  kv: KvLike,
  key: string,
  limit: number,
  ttlSeconds: number,
): Promise<boolean> {
  const count = Number((await kv.get(key)) ?? "0");
  if (count >= limit) return true;
  await kv.put(key, String(count + 1), { expirationTtl: ttlSeconds });
  return false;
}

function reply(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(body === undefined ? {} : { "content-type": "application/json" }) },
  });
}

async function github(env: RelayEnv, path: string, init: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "leonidas-feedback-relay",
      "content-type": "application/json",
    },
  });
}

export async function handleRequest(request: Request, env: RelayEnv): Promise<Response> {
  if (request.method === "OPTIONS") return reply(204);
  const url = new URL(request.url);
  if (request.method !== "POST" || url.pathname !== "/feedback") return reply(404);

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return reply(413);
  let report: Report | null;
  try {
    report = parseReport(JSON.parse(text));
  } catch {
    report = null;
  }
  if (!report) return reply(400, { ok: false });

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const limited =
    (await overLimit(env.RATE, `m:${report.installId}`, PER_INSTALL_PER_MINUTE, 60)) ||
    (await overLimit(env.RATE, `d:${report.installId}`, PER_INSTALL_PER_DAY, 86_400)) ||
    (await overLimit(env.RATE, `ip:${ip}`, PER_IP_PER_HOUR, 3_600));
  if (limited) return reply(429, { ok: false });

  let screenshotUrl: string | null = null;
  if (report.screenshot) {
    const path = `screenshots/${crypto.randomUUID()}.${report.screenshot.ext}`;
    const upload = await github(env, `/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message: "feedback screenshot", content: report.screenshot.base64 }),
    });
    // A failed upload should not lose the report itself.
    if (upload.ok)
      screenshotUrl = `https://github.com/${env.GITHUB_REPO}/blob/main/${path}?raw=true`;
  }

  const issue = await github(env, "/issues", {
    method: "POST",
    body: JSON.stringify(buildIssue(report, screenshotUrl)),
  });
  if (!issue.ok) {
    // Visible in `wrangler tail`; the body names the cause (bad token, missing permission, repo).
    console.error("github issue failed", issue.status, (await issue.text()).slice(0, 300));
    return reply(502, { ok: false });
  }
  const created = (await issue.json()) as { number?: number };
  return reply(200, { ok: true, issue: created.number ?? null });
}
