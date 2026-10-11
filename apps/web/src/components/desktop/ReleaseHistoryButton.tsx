import { useState } from "react";
import { Button } from "../ui/button";
import { ReleaseHistoryDialog } from "./ReleaseHistoryDialog";

export function ReleaseHistoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Update history
      </Button>
      {open ? <ReleaseHistoryDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
