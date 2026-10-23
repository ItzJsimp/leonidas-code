import { defineSlots } from "../twoState/slots";
import { NeedsApprovalCard } from "./NeedsApprovalCard";
import { useNeedsApprovalCount } from "./state";

/** Plugs Marketing into the Command Center. The glob in SlotOutlet finds this file. */
export const slots = defineSlots({
  ccHome: [{ id: "marketing-needs-approval", order: 35, Component: NeedsApprovalCard }],
  headerStat: [
    {
      id: "marketing-needs-approval",
      order: 50,
      label: "Needs approval",
      useValue: useNeedsApprovalCount,
    },
  ],
});
