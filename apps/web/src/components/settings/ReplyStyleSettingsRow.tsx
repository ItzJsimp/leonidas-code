import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";

import { projectEnvironment } from "../../state/projects";
import { useEnvironmentQuery } from "../../state/query";
import { REPLY_STYLE_PROBLEM_TEXT } from "../chat/replyStylePicker.logic";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

/**
 * Reply style for new and existing chats with no chat choice. At a project scope it lists the
 * project's own styles from `.agents/reply-styles`; an environment scope only knows Leonidas.
 */
export function ReplyStyleSettingsRow() {
  const { scope } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["replyStyle"]);
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const member = isProjectScope ? scope.members[0] : undefined;
  const list = useEnvironmentQuery(
    member
      ? projectEnvironment.replyStyles({
          environmentId: member.environmentId,
          input: { cwd: member.workspaceRoot },
        })
      : null,
  );
  const presets = list.data?.presets ?? [];
  const current = settings.replyStyle;
  const options = presets.some((preset) => preset.slug === current)
    ? presets
    : [
        ...(presets.length > 0
          ? presets
          : [{ slug: "leonidas", name: "Leonidas", description: "", builtin: true }]),
        ...(current === "leonidas"
          ? []
          : [{ slug: current, name: current, description: "", builtin: false }]),
      ];
  const nameOf = (slug: string) => options.find((option) => option.slug === slug)?.name || slug;

  return (
    <SettingsRow
      serverScoped
      settingKeys={["replyStyle"]}
      mixed={mixed}
      {...searchableSetting("reply-style")}
      description={
        isProjectScope
          ? "How the AI shapes replies in this project. A chat can change it from the composer."
          : "How the AI shapes replies. A project or a chat can use a different style."
      }
      resetAction={
        current !== DEFAULT_SERVER_SETTINGS.replyStyle ? (
          <SettingResetButton
            label="reply style"
            onClick={() => updateSettings({ replyStyle: DEFAULT_SERVER_SETTINGS.replyStyle })}
          />
        ) : null
      }
      control={
        <Select
          value={mixed ? null : current}
          onValueChange={(value) => {
            if (value) updateSettings({ replyStyle: value });
          }}
        >
          <SelectTrigger size="sm" aria-label="Reply style">
            <SelectValue>{mixed ? "Mixed" : nameOf(current)}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {options.map((option) => (
              <SelectItem key={option.slug} value={option.slug} className="min-w-64">
                <div className="grid gap-0.5">
                  <span className="font-medium">{option.name || option.slug}</span>
                  <span className="text-xs leading-4 text-muted-foreground">
                    {"problem" in option && option.problem
                      ? `Cannot load: ${REPLY_STYLE_PROBLEM_TEXT[option.problem]}`
                      : option.description ||
                        (option.builtin ? "The default Leonidas replies." : "")}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
