import type { WorkspaceOrg } from "@t3tools/contracts";

type Role = Pick<WorkspaceOrg["roles"][number], "write" | "approve" | "manage">;

const WRITE = { none: "", files: "Edits files", all: "Edits anything" } as const;
const APPROVE = { none: "", area: "approves in its area", wall: "approves everywhere" } as const;
const MANAGE = { none: "", area: "manages its area", org: "manages the whole business" } as const;

/** One plain line for what a role can do. */
export function roleWords(role: Role): string {
  const parts = [WRITE[role.write], APPROVE[role.approve], MANAGE[role.manage]].filter(Boolean);
  if (parts.length === 0) return "Can read only";
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
