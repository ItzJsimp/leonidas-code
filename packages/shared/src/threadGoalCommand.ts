export function parseThreadGoalCommand(
  text: string,
):
  | { action: "start"; condition: string }
  | { action: "pause" | "resume" | "clear" | "show" }
  | null {
  const match = /^\/goal(?:\s+([\s\S]*))?$/u.exec(text.trim());
  if (!match) return null;
  const condition = match[1]?.trim() ?? "";
  if (!condition) return { action: "show" };
  if (condition === "pause" || condition === "resume" || condition === "clear")
    return { action: condition };
  return { action: "start", condition };
}
