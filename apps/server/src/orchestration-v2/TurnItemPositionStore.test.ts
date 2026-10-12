import { assert, it } from "@effect/vitest";
import { ThreadId, TurnItemId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Tracer from "effect/Tracer";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as TurnItemPositionStore from "./TurnItemPositionStore.ts";

const layerTest = TurnItemPositionStore.layer.pipe(
  Layer.provideMerge(SqlitePersistence.layerMemory),
);

const traceSqlStatements = () => {
  const statements: Array<string> = [];
  const tracer = Tracer.make({
    span(options) {
      const span = new Tracer.NativeSpan(options);
      const end = span.end.bind(span);
      span.end = (endTime, exit) => {
        end(endTime, exit);
        const query = span.attributes.get("db.query.text");
        if (typeof query === "string") statements.push(query);
      };
      return span;
    },
  });
  return { statements, tracer };
};

it.layer(layerTest)("TurnItemPositionStoreV2", (it) => {
  it.effect("answers a repeat allocation for the same item without SQL", () =>
    Effect.gen(function* () {
      const store = yield* TurnItemPositionStore.TurnItemPositionStoreV2;
      const threadId = ThreadId.make("thread:positions-repeat");
      const turnItemId = TurnItemId.make("item:positions-repeat");
      const first = yield* store.allocate({ threadId, turnItemId, runId: null });

      const repeat = traceSqlStatements();
      const second = yield* store
        .allocate({ threadId, turnItemId, runId: null })
        .pipe(Effect.withTracer(repeat.tracer));
      assert.equal(second, first);
      assert.deepEqual(repeat.statements, []);
    }),
  );

  it.effect("gives a different item in the same thread its own ordinal", () =>
    Effect.gen(function* () {
      const store = yield* TurnItemPositionStore.TurnItemPositionStoreV2;
      const threadId = ThreadId.make("thread:positions-distinct");
      const first = yield* store.allocate({
        threadId,
        turnItemId: TurnItemId.make("item:positions-distinct:a"),
        runId: null,
      });

      // The tracer sees statements for a first sight, so the empty trace above is meaningful.
      const fresh = traceSqlStatements();
      const second = yield* store
        .allocate({
          threadId,
          turnItemId: TurnItemId.make("item:positions-distinct:b"),
          runId: null,
        })
        .pipe(Effect.withTracer(fresh.tracer));
      assert.isAbove(fresh.statements.length, 0);
      assert.equal(second, first + 1);
    }),
  );
});
