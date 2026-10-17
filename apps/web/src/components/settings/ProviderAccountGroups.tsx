import { ProviderDriverKind, type ProviderInstanceId } from "@t3tools/contracts";
import { EllipsisIcon, PlusIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { AccountAction, AccountStatus, AccountUsageMeter } from "./providerAccounts.logic";

export interface AccountRowView {
  readonly instanceId: ProviderInstanceId;
  readonly driver: string;
  readonly displayName: string;
  readonly accentColor: string | undefined;
  readonly enabled: boolean;
  readonly status: AccountStatus;
  /** Five-hour limit first, then the weekly limit. Empty when nothing reports. */
  readonly usage: ReadonlyArray<AccountUsageMeter>;
  /** Built-in accounts can be turned off but not removed. */
  readonly canRemove: boolean;
}

export interface AccountGroupView {
  readonly driver: string;
  readonly label: string;
  readonly rows: ReadonlyArray<AccountRowView>;
  /** Null hides the add button for services that use the advanced dialog. */
  readonly onAdd: (() => void) | null;
}

const ACTION_LABEL: Record<AccountAction, string> = {
  install: "Install",
  signIn: "Sign in",
  addKey: "Add key",
  settings: "Fix",
};

const ACTION_HINT: Record<AccountAction, string> = {
  install: "Installs Claude for free on this computer, then opens the Claude sign-in.",
  signIn: "Opens the sign-in page in your browser. Your plan's usage then shows here.",
  addKey: "Paste the API key from your account page. It stays on this computer.",
  settings: "Opens this account's settings so you can fix the problem.",
};

function UsageMeter({ usage }: { readonly usage: AccountUsageMeter }) {
  const tone =
    usage.percent >= 90 ? "bg-destructive" : usage.percent >= 70 ? "bg-warning" : "bg-success";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className="flex items-center gap-2"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usage.percent}
            aria-label={`${usage.percent}% of the ${usage.label} limit used`}
          />
        }
      >
        <span className="w-12 shrink-0 truncate text-2xs text-muted-foreground">{usage.name}</span>
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", tone)} style={{ width: `${usage.percent}%` }} />
        </div>
        <span className="w-14 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">
          {usage.percent}% used
        </span>
      </TooltipTrigger>
      <TooltipPopup side="top">
        {usage.percent}% of the {usage.label} limit is used.
      </TooltipPopup>
    </Tooltip>
  );
}

function UsageMeters({ meters }: { readonly meters: ReadonlyArray<AccountUsageMeter> }) {
  return (
    <div className="flex w-44 shrink-0 flex-col gap-1.5 @min-[30rem]/accounts:w-56">
      {meters.map((meter) => (
        <UsageMeter key={meter.label} usage={meter} />
      ))}
    </div>
  );
}

function AccountRow({
  row,
  readOnly,
  onAction,
  onRename,
  onToggle,
  onRemove,
  onSettings,
}: {
  readonly row: AccountRowView;
  readonly readOnly: boolean;
  readonly onAction: (row: AccountRowView, action: AccountAction) => void;
  readonly onRename: (row: AccountRowView) => void;
  readonly onToggle: (row: AccountRowView, enabled: boolean) => void;
  readonly onRemove: (row: AccountRowView) => void;
  readonly onSettings: (row: AccountRowView) => void;
}) {
  const { status } = row;
  const dot =
    status.tone === "ok"
      ? "bg-success"
      : status.tone === "attention"
        ? "bg-warning"
        : "bg-muted-foreground/40";
  return (
    <li
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5",
        status.tone === "off" && "opacity-70",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{row.displayName}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {status.tone === "ok" ? null : (
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
          )}
          <span className="truncate">{status.text}</span>
        </p>
      </div>
      {row.usage.length > 0 && status.tone === "ok" ? <UsageMeters meters={row.usage} /> : null}
      {status.action && !readOnly ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="sm" variant="outline" onClick={() => onAction(row, status.action!)}>
                {ACTION_LABEL[status.action]}
              </Button>
            }
          />
          <TooltipPopup side="top">{ACTION_HINT[status.action]}</TooltipPopup>
        </Tooltip>
      ) : null}
      <Menu>
        <MenuTrigger
          render={
            <Button
              type="button"
              variant="ghost-muted"
              size="icon-xs"
              aria-label={`More options for ${row.displayName}`}
            />
          }
        >
          <EllipsisIcon className="size-3.5" />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem disabled={readOnly} onClick={() => onRename(row)}>
            Rename
          </MenuItem>
          <MenuItem disabled={readOnly} onClick={() => onToggle(row, !row.enabled)}>
            {row.enabled ? "Turn off" : "Turn on"}
          </MenuItem>
          <MenuItem onClick={() => onSettings(row)}>Open settings</MenuItem>
          {row.canRemove ? (
            <>
              <MenuSeparator />
              <MenuItem variant="destructive" disabled={readOnly} onClick={() => onRemove(row)}>
                Remove
              </MenuItem>
            </>
          ) : null}
        </MenuPopup>
      </Menu>
    </li>
  );
}

/** Accounts grouped by service: one heading per service, one row per account. */
export function ProviderAccountGroups({
  groups,
  readOnly,
  onAction,
  onRename,
  onToggle,
  onRemove,
  onSettings,
}: {
  readonly groups: ReadonlyArray<AccountGroupView>;
  readonly readOnly: boolean;
  readonly onAction: (row: AccountRowView, action: AccountAction) => void;
  readonly onRename: (row: AccountRowView) => void;
  readonly onToggle: (row: AccountRowView, enabled: boolean) => void;
  readonly onRemove: (row: AccountRowView) => void;
  readonly onSettings: (row: AccountRowView) => void;
}) {
  return (
    <div className="@container/accounts space-y-5">
      {groups.map((group) => (
        <section key={group.driver} aria-label={group.label}>
          <div className="mb-2 flex items-center gap-2">
            <ProviderInstanceIcon
              driverKind={ProviderDriverKind.make(group.driver)}
              displayName={group.label}
              iconClassName="size-4"
            />
            <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
            <span className="text-xs text-muted-foreground">
              {group.rows.length === 1 ? "1 account" : `${group.rows.length} accounts`}
            </span>
            {group.onAdd && !readOnly ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="xs"
                      variant="outline"
                      className="ms-auto"
                      data-usage-id="add_provider"
                      onClick={group.onAdd}
                    >
                      <PlusIcon />
                      Add account
                    </Button>
                  }
                />
                <TooltipPopup side="top">
                  Connect one more {group.label} account. Each account keeps its own sign-in.
                </TooltipPopup>
              </Tooltip>
            ) : null}
          </div>
          <ul className="space-y-1.5">
            {group.rows.map((row) => (
              <AccountRow
                key={row.instanceId}
                row={row}
                readOnly={readOnly}
                onAction={onAction}
                onRename={onRename}
                onToggle={onToggle}
                onRemove={onRemove}
                onSettings={onSettings}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
