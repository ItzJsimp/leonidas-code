import {
  ArrowLeftIcon,
  ActivityIcon,
  ChartNoAxesColumnIcon,
  GitBranchIcon,
  ImageIcon,
  ListChecksIcon,
  RadarIcon,
  LifeBuoyIcon,
  MessageSquareWarningIcon,
  ScrollTextIcon,
  SettingsIcon,
  AudioLinesIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { KeybindingCommand } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { memo, useCallback } from "react";
import { shortcutLabelForCommand } from "../../keybindings";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";

import { APP_VERSION_LABEL } from "../../branding";
import { useEnvironmentIdentificationMode } from "../../hooks/useSettings";
import { cn } from "../../lib/utils";
import { usePrimaryEnvironment, usePullRequestsSupported } from "../../state/environments";
import {
  resolveEnvironmentIdentificationPillLabel,
  resolveSidebarStageBackdropVariant,
  SidebarStageBackdrop,
  useEnvironmentStageLabel,
} from "../SidebarStageBackdrop";
import { Badge } from "../ui/badge";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { readPullRequestListPreferences } from "../pullRequest/pullRequestListPreferences";
import { isSidebarUtilityPage, useNavigateToMainApp } from "./mainAppLocation";
import { SidebarThreadUndoNotice } from "./SidebarThreadUndoNotice";
import { SidebarProviderUpdatePill } from "./SidebarProviderUpdatePill";
import { FEEDBACK_ENABLED } from "../feedback/feedbackRelay";
import { openStuck, STUCK_ENABLED } from "../community/stuckStore";
import { openFeedback } from "../feedback/feedbackStore";
import { SidebarUpdateArchitectureWarning, SidebarUpdatePill } from "./SidebarUpdatePill";
import { openReleaseHistoryDialog } from "../desktop/ReleaseHistoryDialog";
import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { observeResize } from "~/lib/observeResize";

export const SidebarChromeHeader = memo(function SidebarChromeHeader({
  isElectron,
}: {
  isElectron: boolean;
}) {
  const stageLabel = useEnvironmentStageLabel();
  const environmentIdentificationMode = useEnvironmentIdentificationMode();
  const backdropVariant = resolveSidebarStageBackdropVariant(
    stageLabel,
    environmentIdentificationMode === "artwork",
  );
  const pillLabel =
    environmentIdentificationMode === "pill"
      ? resolveEnvironmentIdentificationPillLabel(stageLabel)
      : null;

  return (
    // The titlebar row, not a padded SidebarHeader: it aligns to the window controls.
    <div
      className={cn(
        "relative flex h-[var(--workspace-topbar-height)] shrink-0 flex-row items-center gap-2 px-3 md:pl-0",
        isElectron && "drag-region",
      )}
    >
      {backdropVariant ? <SidebarStageBackdrop variant={backdropVariant} /> : null}
      <SidebarTrigger
        // Over the stage artwork: the media viewer's control-on-imagery treatment.
        variant={backdropVariant ? "media-navigation" : "ghost"}
        className="relative top-auto z-10 translate-y-0 md:hidden"
      />
      {/* One visible line: the pill wraps onto the clipped second line once it no longer fits.
          The padding keeps the brand's focus ring inside the clip. */}
      <div className="relative z-10 flex h-8 min-w-0 flex-1 flex-wrap content-start items-center gap-x-2 overflow-hidden py-0.5">
        <SidebarBrand onBackdrop={backdropVariant !== null} />
        {pillLabel ? (
          <div className="ml-1 flex h-7 items-center">
            <Badge data-environment-identification="pill" size="sm" variant="secondary">
              {pillLabel}
            </Badge>
          </div>
        ) : null}
        <button
          type="button"
          title="Version of Leonidas. Click to see what changed in each update."
          onClick={openReleaseHistoryDialog}
          className={cn(
            "h-7 shrink-0 rounded-md px-1 text-xs tabular-nums outline-hidden ring-ring focus-visible:ring-2 focus-visible:ring-inset",
            backdropVariant
              ? "text-white/70 hover:text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          v{APP_VERSION_LABEL}
        </button>
      </div>
    </div>
  );
});

// Measures the brand at its titlebar inset, plus the header's right padding and the
// sidebar border, so the sidebar minimum follows font size, zoom and macOS window controls.
export function SidebarBrandWidthProbe({
  onWidthChange,
}: {
  onWidthChange: (width: number) => void;
}) {
  const observeWidth = useCallback(
    (probe: HTMLDivElement) => {
      return observeResize(probe, ([entry]) => {
        if (entry) onWidthChange(entry.borderBoxSize[0]?.inlineSize ?? probe.offsetWidth);
      });
    },
    [onWidthChange],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none invisible fixed top-0 left-0 flex w-max border-r border-transparent pr-3"
      ref={observeWidth}
    >
      <div className="ml-[var(--workspace-titlebar-content-left)] flex">
        <SidebarBrandMark onBackdrop={false} />
      </div>
    </div>
  );
}

function resolveCurrentAppName(pathname: string): string {
  if (pathname === "/command-center" || pathname.startsWith("/command-center/"))
    return "Command Center";
  if (pathname === "/scribe" || pathname.startsWith("/scribe/")) return "Scribe";
  if (pathname === "/images" || pathname.startsWith("/images/")) return "Images";
  if (pathname === "/brain" || pathname.startsWith("/brain/")) return "Brain";
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "Tasks";
  if (pathname === "/system-care" || pathname.startsWith("/system-care/")) return "Device Health";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname === "/usage" || pathname.startsWith("/usage/")) return "Usage";
  if (pathname === "/pull-requests" || pathname.startsWith("/pull-requests/"))
    return "Pull requests";
  return "Chat";
}

function SidebarBrand({ onBackdrop }: { onBackdrop: boolean }) {
  const currentApp = useLocation({
    select: (location) => resolveCurrentAppName(location.pathname),
  });
  return (
    <Link
      aria-label={`Leonidas \u00b7 ${currentApp}`}
      className={cn(
        "relative z-10 ml-[var(--workspace-titlebar-content-left)] hidden h-7 w-fit min-w-0 shrink-0 items-center overflow-hidden rounded-md outline-hidden ring-ring focus-visible:ring-2 focus-visible:ring-inset md:flex",
        onBackdrop ? "text-white" : "text-foreground",
      )}
      to="/command-center"
    >
      <SidebarBrandMark onBackdrop={onBackdrop} currentApp={currentApp} />
    </Link>
  );
}

function SidebarBrandMark({
  onBackdrop,
  currentApp = "Chat",
}: {
  onBackdrop: boolean;
  currentApp?: string;
}) {
  return (
    // Center the visible capitals, without the font's ascender/descender space.
    // Padding keeps ascenders and round-letter overshoot inside the truncation clip.
    <span className="inline-flex min-w-0 items-baseline gap-1 text-sm font-medium tracking-tight">
      <span className="[text-box:trim-both_cap_alphabetic]">Leonidas</span>
      <span
        aria-hidden="true"
        className={cn(
          "text-xs select-none",
          onBackdrop ? "text-white/50" : "text-muted-foreground/50",
        )}
      >
        ·
      </span>
      <span
        className={cn(
          "truncate [text-box:trim-both_cap_alphabetic] supports-[text-box:trim-both_cap_alphabetic]:py-1",
          onBackdrop ? "text-white/70" : "text-muted-foreground",
        )}
      >
        {currentApp}
      </span>
    </span>
  );
}

function SidebarUtilityItem({
  icon,
  label,
  tourId,
  usageId,
  shortcutCommand,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  /** Command whose shortcut is appended to the tooltip. */
  shortcutCommand?: KeybindingCommand;
  /** Feature tour anchor, see `features/tour/tourTargets.ts`. */
  tourId?: string;
  /** Usage analytics id; must be in USAGE_UI_ELEMENT_IDS. */
  usageId?: string;
  onClick: () => void;
}) {
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const shortcutLabel = shortcutCommand
    ? shortcutLabelForCommand(keybindings, shortcutCommand)
    : null;
  return (
    <SidebarMenuItem className="flex w-8 min-w-0 shrink justify-center">
      <Tooltip>
        <TooltipTrigger
          render={
            <SidebarMenuButton
              aria-label={label}
              data-tour={tourId}
              data-usage-id={usageId}
              onClick={onClick}
              size="icon"
              className="w-full max-w-8"
            >
              {icon}
            </SidebarMenuButton>
          }
        />
        <TooltipPopup side="top">
          {shortcutLabel ? `${label} (${shortcutLabel})` : label}
        </TooltipPopup>
      </Tooltip>
    </SidebarMenuItem>
  );
}

const SidebarUtilityMenu = memo(function SidebarUtilityMenu() {
  const navigate = useNavigate();
  const navigateToMainApp = useNavigateToMainApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const isOnUtilityPage = useLocation({
    select: (location) => isSidebarUtilityPage(location.pathname),
  });
  const pullRequestsSupported = usePullRequestsSupported();
  // The Scribe engine runs on Windows only. The server host decides, not this browser.
  const scribeSupported =
    usePrimaryEnvironment()?.serverConfig?.environment.platform.os === "windows";

  const closeMobileSidebar = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
  const handlePullRequestsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({
      to: "/pull-requests",
      search: readPullRequestListPreferences(),
    });
  }, [closeMobileSidebar, navigate]);
  const handleSettingsClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/settings" });
  }, [closeMobileSidebar, navigate]);

  const handleCommandCenterClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/command-center" });
  }, [closeMobileSidebar, navigate]);

  const handleGitClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/git" });
  }, [closeMobileSidebar, navigate]);

  const handleTasksClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/tasks" });
  }, [closeMobileSidebar, navigate]);

  const handleUsageClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    void navigate({ to: "/usage" });
  }, [isMobile, navigate, setOpenMobile]);

  const handleScribeClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/scribe" });
  }, [closeMobileSidebar, navigate]);

  const handleImagesClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/images" });
  }, [closeMobileSidebar, navigate]);

  const handleSystemCareClick = useCallback(() => {
    closeMobileSidebar();
    void navigate({ to: "/system-care" });
  }, [closeMobileSidebar, navigate]);

  const handleUpdateHistoryClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    openReleaseHistoryDialog();
  }, [isMobile, setOpenMobile]);

  const handleFeedbackClick = useCallback(() => {
    closeMobileSidebar();
    openFeedback({ source: "sidebar" });
  }, [closeMobileSidebar]);

  const handleStuckClick = useCallback(() => {
    closeMobileSidebar();
    openStuck("button");
  }, [closeMobileSidebar]);

  const handleBackClick = useCallback(() => {
    closeMobileSidebar();
    void navigateToMainApp();
  }, [closeMobileSidebar, navigateToMainApp]);

  return (
    <SidebarMenu className="flex-row flex-nowrap items-center">
      {isOnUtilityPage ? (
        <SidebarMenuItem className="min-w-0 flex-1">
          <SidebarMenuButton onClick={handleBackClick}>
            <ArrowLeftIcon />
            <span>Back</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : (
        // One row at every width. Buttons keep a fixed size and gap, so dragging the
        // sidebar never spreads them; they only shrink when the sidebar is too narrow.
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5">
          <SidebarUtilityItem
            icon={<SettingsIcon />}
            label="Settings"
            usageId="open_settings"
            shortcutCommand="settings.open"
            onClick={handleSettingsClick}
          />
          <SidebarUtilityItem
            icon={<RadarIcon />}
            label="Command Center"
            usageId="open_command_center"
            tourId="sidebar-command-center"
            onClick={handleCommandCenterClick}
          />
          <SidebarUtilityItem
            icon={<ListChecksIcon />}
            label="Tasks"
            usageId="open_tasks"
            shortcutCommand="tasks.open"
            tourId="sidebar-tasks"
            onClick={handleTasksClick}
          />
          <SidebarUtilityItem icon={<GitBranchIcon />} label="Git" onClick={handleGitClick} />
          {scribeSupported ? (
            <SidebarUtilityItem
              icon={<AudioLinesIcon />}
              label="Scribe"
              usageId="open_scribe"
              onClick={handleScribeClick}
            />
          ) : null}
          {pullRequestsSupported ? (
            <SidebarUtilityItem
              icon={<PullRequestGlyph.pullRequest />}
              label="Pull requests"
              onClick={handlePullRequestsClick}
            />
          ) : null}
          <SidebarUtilityItem
            icon={<ChartNoAxesColumnIcon />}
            label="Usage"
            usageId="open_usage"
            shortcutCommand="usage.open"
            tourId="sidebar-usage"
            onClick={handleUsageClick}
          />
          <SidebarUtilityItem icon={<ImageIcon />} label="Images" onClick={handleImagesClick} />
          <SidebarUtilityItem
            icon={<ActivityIcon />}
            label="PC Tuning"
            onClick={handleSystemCareClick}
          />
          <SidebarUtilityItem
            icon={<ScrollTextIcon />}
            label="Update history"
            tourId="sidebar-updates"
            onClick={handleUpdateHistoryClick}
          />
          {STUCK_ENABLED ? (
            <SidebarUtilityItem
              icon={<LifeBuoyIcon />}
              label="I'm stuck"
              onClick={handleStuckClick}
            />
          ) : null}
          {FEEDBACK_ENABLED ? (
            <SidebarUtilityItem
              icon={<MessageSquareWarningIcon />}
              label="Send feedback"
              usageId="send_feedback"
              onClick={handleFeedbackClick}
            />
          ) : null}
        </div>
      )}
      <SidebarUpdatePill />
    </SidebarMenu>
  );
});

export const SidebarChromeFooter = memo(function SidebarChromeFooter() {
  return (
    <SidebarFooter>
      <SidebarThreadUndoNotice />
      <SidebarProviderUpdatePill />
      <SidebarUpdateArchitectureWarning />
      <SidebarUtilityMenu />
    </SidebarFooter>
  );
});
