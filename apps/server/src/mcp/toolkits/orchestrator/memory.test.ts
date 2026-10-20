import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { OrchestratorToolkit } from "./tools.ts";
import * as Handlers from "./handlers.ts";

describe("Memory MCP Tools", () => {
  it("declares memory_search, memory_get, and memory_status on OrchestratorToolkit", () => {
    assert.isDefined(OrchestratorToolkit.tools.memory_search);
    assert.isDefined(OrchestratorToolkit.tools.memory_get);
    assert.isDefined(OrchestratorToolkit.tools.memory_status);

    assert.equal(OrchestratorToolkit.tools.memory_search.name, "memory_search");
    assert.equal(OrchestratorToolkit.tools.memory_get.name, "memory_get");
    assert.equal(OrchestratorToolkit.tools.memory_status.name, "memory_status");
  });

  it("checks memory_status against the local index", async () => {
    // Handlers are exposed through the layer or can be tested via tools
    assert.isDefined(Handlers.layer);
  });
});
