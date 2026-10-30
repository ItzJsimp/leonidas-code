import { NodeId, PlanId, ProjectId, RunId } from "@t3tools/contracts";
import {
  getLatestThreadForProject,
  sortActiveThreadsByOrderKey,
  sortPinnedThreadsByOrderKey,
  sortThreads,
} from "@t3tools/client-runtime/state/thread-sort";
import { formatHourShort, formatRelativeHourShort } from "@t3tools/shared/usageFormat";
import { describe, test } from "vite-plus/test";

import { makeStreamingTimelineFixture, makeThreadProjectionFixture } from "./test-fixtures";
import {
  deriveActivePlanState,
  deriveTimelineEntriesFromVisibleTurnItems,
  deriveTimelineEntriesFromVisibleTurnItemsWithState,
} from "./session-logic";

const projectId = ProjectId.make("benchmark-project");
const runId = RunId.make("benchmark-run");
const start = Date.parse("2026-08-11T00:00:00.000Z");
const threads = Array.from({ length: 1_000 }, (_, index) => {
  const timestamp = new Date(start + ((index * 997) % 1_000) * 60_000).toISOString();
  return {
    id: `thread-${index}`,
    projectId,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    latestUserMessageAt: timestamp,
    unsettledAt: null,
  };
});
const baseProjection = makeThreadProjectionFixture();
const projection = {
  ...baseProjection,
  plans: Array.from({ length: 5 }, (_, index) => ({
    id: PlanId.make(`plan-${index}`),
    runId,
    threadId: baseProjection.thread.id,
    nodeId: NodeId.make("bench-node"),
    status: "active" as const,
    kind: "todo_list" as const,
    steps: [{ id: "check", text: "Run checks", status: "running" as const }],
  })),
};
// 200 copies of the 6-item fixture make a long thread of 1,200 turn items.
const timelineFixture = makeStreamingTimelineFixture("Partial");
const longTimelineItems = Array.from({ length: 200 }, (_, copy) =>
  timelineFixture.visibleTurnItems.map((row) => ({
    ...row,
    sourceItemId: `${row.sourceItemId}-${copy}`,
    item: {
      ...row.item,
      id: `${row.item.id}-${copy}`,
      ...("messageId" in row.item ? { messageId: `${row.item.messageId}-${copy}` } : {}),
    },
  })),
).flat() as typeof timelineFixture.visibleTurnItems;
const timelineInput = { visibleTurnItems: longTimelineItems, optimisticMessages: [] };
const lastToolIndex = longTimelineItems.findLastIndex((row) => row.item.type === "dynamic_tool");
const updatedTimelineInput = {
  ...timelineInput,
  visibleTurnItems: longTimelineItems.map((row, index) =>
    index === lastToolIndex ? { ...row, item: { ...row.item, output: "Updated" } } : row,
  ) as typeof longTimelineItems,
};
const previousTimeline = deriveTimelineEntriesFromVisibleTurnItemsWithState(timelineInput);
const hours = Array.from({ length: 24 }, (_, index) =>
  new Date(start + index * 3_600_000).toISOString(),
);
const referenceTime = "2026-08-12T00:00:00.000Z";

describe("client performance", () => {
  test("sort 1000 threads by recent activity", async ({ bench }) => {
    await bench("sort", () => {
      sortThreads(threads, "updated_at");
    }).run();
  });
  test("sort 1000 active threads", async ({ bench }) => {
    await bench("sort", () => {
      sortActiveThreadsByOrderKey(threads);
    }).run();
  });
  test("sort 1000 keyless pinned threads", async ({ bench }) => {
    await bench("sort", () => {
      sortPinnedThreadsByOrderKey(threads);
    }).run();
  });
  test("select latest project thread from 1000 threads", async ({ bench }) => {
    await bench("select", () => {
      getLatestThreadForProject(threads, projectId, "updated_at");
    }).run();
  });
  test("derive current plan from 5 normalized plans", async ({ bench }) => {
    await bench("derive", () => {
      deriveActivePlanState(projection, runId);
    }).run();
  });
  test("format 24 hourly usage labels and tooltips", async ({ bench }) => {
    await bench("format", () => {
      hours.map((hour) => [
        formatHourShort(hour, "America/New_York"),
        formatRelativeHourShort(hour, referenceTime, "America/New_York"),
      ]);
    }).run();
  });
  test("derive 1200 timeline entries from scratch", async ({ bench }) => {
    await bench("derive", () => {
      deriveTimelineEntriesFromVisibleTurnItems(timelineInput);
    }).run();
  });
  test("update one tool in a 1200 item timeline", async ({ bench }) => {
    await bench("update", () => {
      deriveTimelineEntriesFromVisibleTurnItemsWithState(updatedTimelineInput, previousTimeline);
    }).run();
  });
});
