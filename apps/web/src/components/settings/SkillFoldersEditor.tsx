import {
  createSkillFolder,
  deleteSkillFolder,
  renameSkillFolder,
  setSkillInFolder,
} from "@t3tools/client-runtime/skillFolders";
import type { ServerProviderSkill, SkillFolderPrefs } from "@t3tools/contracts";
import { FolderPlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { memo, useId, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

function SkillAdder(props: {
  folderName: string;
  suggestions: ReadonlyArray<string>;
  onAdd: (skillName: string) => void;
}) {
  const [value, setValue] = useState("");
  const listId = useId();
  const commit = () => {
    const name = value.trim().replace(/^[/$]|^skill:/i, "");
    if (!name) return;
    props.onAdd(name);
    setValue("");
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        list={listId}
        aria-label={`Add a skill to ${props.folderName}`}
        placeholder="Add a skill by name"
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
        }}
      />
      <datalist id={listId}>
        {props.suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Button size="compact" variant="outline" disabled={!value.trim()} onClick={commit}>
        Add
      </Button>
    </div>
  );
}

/**
 * Edits the user's own skill folders. Skills are matched by name, so a folder can name a skill that
 * only some projects have; the slash menu shows the members that the current workspace offers.
 */
export const SkillFoldersEditor = memo(function SkillFoldersEditor(props: {
  prefs: SkillFolderPrefs;
  availableSkills: ReadonlyArray<ServerProviderSkill>;
  onChange: (prefs: SkillFolderPrefs) => void;
}) {
  const { prefs, onChange } = props;
  const [newName, setNewName] = useState("");
  const suggestions = [...new Set(props.availableSkills.map((skill) => skill.name))].toSorted(
    (left, right) => left.localeCompare(right),
  );
  const addFolder = () => {
    const next = createSkillFolder(prefs, newName);
    if (next === prefs) return;
    onChange(next);
    setNewName("");
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          aria-label="New skill folder name"
          placeholder="New folder, for example Audits"
          onChange={(event) => setNewName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addFolder();
            }
          }}
        />
        <Button size="compact" variant="outline" disabled={!newName.trim()} onClick={addFolder}>
          <FolderPlusIcon aria-hidden="true" />
          New folder
        </Button>
      </div>
      {prefs.folders.length === 0 ? (
        <p className="text-secondary-label text-xs">
          No folders yet. Skills with a category or a source repo already group themselves in the /
          menu.
        </p>
      ) : (
        prefs.folders.map((folder) => (
          <div key={folder.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                key={folder.name}
                defaultValue={folder.name}
                aria-label={`Rename folder ${folder.name}`}
                onBlur={(event) => {
                  const next = event.currentTarget.value;
                  if (next.trim() && next !== folder.name) {
                    onChange(renameSkillFolder(prefs, folder.id, next));
                  } else {
                    event.currentTarget.value = folder.name;
                  }
                }}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete folder ${folder.name}`}
                onClick={() => onChange(deleteSkillFolder(prefs, folder.id))}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {folder.skills.length === 0 ? (
                <span className="text-secondary-label text-xs">Empty</span>
              ) : (
                folder.skills.map((skillName) => (
                  <span
                    key={skillName}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
                  >
                    {skillName}
                    <button
                      type="button"
                      aria-label={`Remove ${skillName} from ${folder.name}`}
                      className="cursor-pointer text-secondary-label hover:text-foreground"
                      onClick={() => onChange(setSkillInFolder(prefs, folder.id, skillName, false))}
                    >
                      <XIcon aria-hidden="true" className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <SkillAdder
              folderName={folder.name}
              suggestions={suggestions}
              onAdd={(skillName) => onChange(setSkillInFolder(prefs, folder.id, skillName, true))}
            />
          </div>
        ))
      )}
    </div>
  );
});
