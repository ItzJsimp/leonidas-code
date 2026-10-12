import { describe, expect, it } from "vite-plus/test";
import {
  NodeId,
  RuntimeRequestId,
  TurnItemId,
  type OrchestrationV2TurnItem,
} from "@t3tools/contracts";
import {
  v2Now,
  v2ThreadId,
} from "../../../packages/client-runtime/src/state/orchestrationV2TestFixtures.ts";
import { derivePendingThreadRequests } from "../../../packages/client-runtime/src/state/threadRequests.ts";
import { recordAcceptance } from "../../../scripts/harness-acceptance.record.ts";

describe("internal long-thread acceptance", () => {
  it.each([100, 1_000, 10_000])(
    "selects the newest pending question among %i older items",
    (size) => {
      const requestId = RuntimeRequestId.make("acceptance-question");
      const nodeId = NodeId.make("acceptance-node");
      const makeItem = (ordinal: number): OrchestrationV2TurnItem => ({
        id: TurnItemId.make(`acceptance-${ordinal}`),
        threadId: v2ThreadId,
        runId: null,
        nodeId,
        providerThreadId: null,
        providerTurnId: null,
        nativeItemRef: null,
        parentItemId: null,
        ordinal,
        status: "completed",
        title: null,
        startedAt: v2Now,
        completedAt: v2Now,
        updatedAt: v2Now,
        type: "user_input_request",
        requestId,
        responseMode: "message",
        questions: [{ id: "next", header: "Next", question: `Question ${ordinal}`, options: [] }],
      });
      // The newest item precedes appended older history, as it does after paging.
      const projection = {
        turnItems: [makeItem(size), ...Array.from({ length: size }, (_, index) => makeItem(index))],
        runtimeRequests: [
          {
            id: requestId,
            nodeId,
            providerTurnId: null,
            nativeRequestRef: null,
            kind: "user_input" as const,
            status: "pending" as const,
            responseCapability: { type: "message" as const },
            createdAt: v2Now,
            resolvedAt: null,
          },
        ],
      };
      const run = () => derivePendingThreadRequests(projection);
      expect(run().userInputs[0]?.questions[0]?.question).toBe(`Question ${size}`);
      expect(run().userInputs).toHaveLength(1);
      expect(run().userInputs[0]?.responseMode).toBe("message");
      if (!process.env.LEONIDAS_ACCEPTANCE_OUTPUT_DIR) return;
      for (let index = 0; index < 20; index++) run();
      const samplesMs = Array.from({ length: 101 }, () => {
        const started = performance.now();
        run();
        return performance.now() - started;
      });
      recordAcceptance(`pending-question/${size}-older-items`, samplesMs);
    },
  );
});
