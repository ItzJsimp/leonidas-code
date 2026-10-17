import { BotIcon, XIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";

import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { ComposerBanner } from "../chat/ComposerBanner";
import { searchSubagentOptions, type ComposerSubagentOption } from "./subagentThread.logic";

/**
 * Shoulder tab that attaches one subagent to this chat. While attached, every
 * message you send goes to that subagent, until you detach it.
 */
export const ComposerSubagentsButton = memo(function ComposerSubagentsButton(props: {
  options: ReadonlyArray<ComposerSubagentOption>;
  attached: string | null;
  onAttach: (name: string) => void;
  onDetach: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchSubagentOptions(props.options, query),
    [props.options, query],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <ComposerBanner.Root density="comfortable" width="content" data-composer-shoulder-tab>
        <PopoverTrigger
          render={<ComposerBanner.Row render={<button type="button" />} />}
          aria-label={
            props.attached
              ? `Subagent: ${props.attached} is attached to this chat`
              : "Helper: attach one to this chat"
          }
          className="text-muted-foreground transition-colors duration-200 hover:text-foreground data-[attached=true]:text-foreground"
          data-attached={props.attached !== null}
          onPointerDown={(event) => event.preventDefault()}
        >
          <ComposerBanner.Icon>
            <BotIcon />
          </ComposerBanner.Icon>
          <ComposerBanner.Content>
            {props.attached ? `@${props.attached}` : "Helper"}
          </ComposerBanner.Content>
        </PopoverTrigger>
      </ComposerBanner.Root>
      <PopoverPopup side="top" align="end" className="w-80">
        <div className="p-2">
          <Input
            autoFocus
            value={query}
            placeholder="Search helpers"
            aria-label="Search helpers"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {props.attached ? (
          <button
            type="button"
            className="flex w-full items-center gap-2 border-y px-3 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            onClick={() => {
              props.onDetach();
              setOpen(false);
            }}
          >
            <XIcon className="size-3.5" />
            <span className="truncate">Detach @{props.attached}</span>
          </button>
        ) : null}
        <ScrollArea className="max-h-72">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {props.options.length === 0
                ? "No helper is on. Turn one on in the Helpers view."
                : "No helpers found"}
            </p>
          ) : (
            <ul className="flex flex-col pb-1">
              {results.map((option) => (
                <li key={option.name}>
                  <button
                    type="button"
                    aria-pressed={props.attached === option.name}
                    className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      props.onAttach(option.name);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="truncate text-sm font-medium">
                      @{option.name}
                      {props.attached === option.name ? " (attached)" : ""}
                    </span>
                    {option.description ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverPopup>
    </Popover>
  );
});
