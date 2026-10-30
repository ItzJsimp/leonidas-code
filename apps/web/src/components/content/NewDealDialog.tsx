import type { ContentCreateDealInput, ContentDeal } from "@t3tools/contracts";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";

export type NewDealInput = Omit<ContentCreateDealInput, "workspaceId">;
/** The new deal, or the server's own words when it refused. */
export type CreateDealFn = (input: NewDealInput) => Promise<ContentDeal | string>;

const FIELDS = [
  { key: "contact", label: "Contact", placeholder: "Name and email" },
  { key: "deadline", label: "Deadline", type: "date" },
  { key: "driveFolder", label: "Drive folder", placeholder: "Folder link or id" },
  { key: "briefLink", label: "Brief link", placeholder: "https://" },
] as const;

type Values = Record<"brand" | "terms" | (typeof FIELDS)[number]["key"], string>;
const EMPTY: Values = {
  brand: "",
  terms: "",
  contact: "",
  deadline: "",
  driveFolder: "",
  briefLink: "",
};

function NewDealForm(props: {
  readonly create: CreateDealFn;
  readonly onDone: (brand: string) => void;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const set = (key: keyof Values) => (event: { readonly target: { readonly value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));
  const ready = values.brand.trim().length > 0 && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setProblem(null);
    // Blank fields are left out, so the server sees only what the person typed.
    const input = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim().length > 0),
    ) as NewDealInput;
    const result = await props.create(input);
    setBusy(false);
    if (typeof result === "string") setProblem(result);
    else props.onDone(result.brand);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>New deal</DialogTitle>
        <DialogDescription>
          Start a deal by hand. It gets its own folder. Add videos to it after.
        </DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Brand</span>
            <Input
              autoFocus
              aria-label="Brand"
              placeholder="Acme Cases"
              value={values.brand}
              onChange={set("brand")}
            />
          </label>
          {FIELDS.map((field) => (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="font-medium">{field.label}</span>
              <Input
                aria-label={field.label}
                type={"type" in field ? field.type : "text"}
                {...("placeholder" in field ? { placeholder: field.placeholder } : {})}
                value={values[field.key]}
                onChange={set(field.key)}
              />
            </label>
          ))}
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Terms</span>
            <Textarea
              aria-label="Terms"
              rows={3}
              placeholder="Pay, number of videos, usage rights"
              value={values.terms}
              onChange={set("terms")}
            />
          </label>
          {problem ? (
            <p role="alert" className="text-destructive-foreground text-sm">
              {problem}
            </p>
          ) : null}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button disabled={!ready} onClick={() => void submit()}>
          {busy ? <Spinner /> : null}
          Start deal
        </Button>
      </DialogFooter>
    </>
  );
}

/** The New deal button and its form. The caller shows the button only to a person who may write. */
export function NewDealButton(props: {
  readonly create: CreateDealFn;
  readonly onCreated: (brand: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon />
        New deal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup>
          {open ? (
            <NewDealForm
              create={props.create}
              onDone={(brand) => {
                setOpen(false);
                props.onCreated(brand);
              }}
            />
          ) : null}
        </DialogPopup>
      </Dialog>
    </>
  );
}
