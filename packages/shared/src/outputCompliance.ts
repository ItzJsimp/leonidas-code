import { parseOutputDock } from "./outputDock.ts";

/** Fixed canvas categories and the 400-word body threshold; examples in fences are excluded. */
export function canvasRequired(body: string) {
  const prose = body.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, "");
  return (
    prose.trim().split(/\s+/).filter(Boolean).length > 400 ||
    /^#{1,6}\s+[^\p{L}\p{N}]*(?:(?:system|technical)\s+)?(?:spec(?:ification)?|architecture|(?:deep\s+)?research|roadmap|audit)\b/imu.test(
      prose,
    )
  );
}

/** Measurement only. Eligibility is a documented heuristic, never grounds for an automatic retry. */
export function measureOutputCompliance(text: string, canvasPresent: boolean) {
  const dock = parseOutputDock(text);
  const body = dock?.body ?? text;
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  const top =
    /^(?:\*\*Active Mode:\*\*[^\n]*\n)?🎯 \*\*Focus:\*\* `[^`\n]+` · \*\*Step:\*\* `[^`\n]+`\n\s*\n/.test(
      body,
    );
  const required = canvasRequired(body);
  return {
    version: 1,
    eligible: Boolean(dock) || top || wordCount >= 80 || required,
    top,
    dock: dock !== null,
    wordCount,
    canvasRequired: required,
    canvasPresent,
    canvas: !required || canvasPresent,
  };
}
