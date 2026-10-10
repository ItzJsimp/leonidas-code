import { describe, expect, it } from "@effect/vitest";
import { LocalVmError, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as LocalVmHost from "./LocalVmHost.ts";
import * as LocalVmService from "./LocalVmService.ts";

describe("LocalVmService", () => {
  it.effect("grants one thread guest input, refuses other threads and honors pause", () => {
    const inputs: string[] = [];
    const host = Layer.succeed(LocalVmHost.LocalVmHost, {
      list: Effect.succeed({
        available: true,
        vms: [{ id: "test-vm", name: "Test VM", running: true }],
      }),
      screenshot: () =>
        Effect.succeed({ mimeType: "image/png" as const, data: "png", width: 800, height: 600 }),
      input: (vmId) =>
        Effect.sync(() => {
          inputs.push(vmId);
        }),
    });
    return Effect.gen(function* () {
      const service = yield* LocalVmService.LocalVmService;
      const threadId = ThreadId.make("owner");
      const other = ThreadId.make("other");
      yield* service.connect({ threadId, vmId: "test-vm" });
      expect(
        (yield* Effect.result(service.connect({ threadId: other, vmId: "test-vm" })))._tag,
      ).toBe("Failure");
      expect((yield* Effect.result(service.screenshot({ threadId: other })))._tag).toBe("Failure");
      expect(
        (yield* Effect.result(
          service.input({ threadId: other, action: { kind: "type", text: "Hello" } }),
        ))._tag,
      ).toBe("Failure");
      yield* service.input({ threadId, action: { kind: "click", x: 100, y: 100, button: "left" } });
      expect(inputs).toEqual(["test-vm"]);
      yield* service.pause({ threadId, paused: true });
      expect(
        (yield* Effect.result(service.input({ threadId, action: { kind: "type", text: "Hello" } })))
          ._tag,
      ).toBe("Failure");
      expect((yield* service.screenshot({ threadId })).screenshot.width).toBe(800);
      yield* service.release({ threadId });
      yield* service.connect({ threadId: other, vmId: "test-vm" });
      expect(inputs).toEqual(["test-vm"]);
    }).pipe(Effect.provide(LocalVmService.layer.pipe(Layer.provide(host))));
  });
  it.effect(
    "rejects coordinates outside the actual screen and invalid text before sending input",
    () => {
      const inputs: string[] = [];
      const host = Layer.succeed(LocalVmHost.LocalVmHost, {
        list: Effect.succeed({
          available: true,
          vms: [{ id: "test-vm", name: "Test VM", running: true }],
        }),
        screenshot: () =>
          Effect.succeed({ mimeType: "image/png" as const, data: "png", width: 800, height: 600 }),
        input: (vmId) =>
          Effect.sync(() => {
            inputs.push(vmId);
          }),
      });
      return Effect.gen(function* () {
        const service = yield* LocalVmService.LocalVmService;
        const threadId = ThreadId.make("owner");
        yield* service.connect({ threadId, vmId: "test-vm" });
        expect(
          (yield* service
            .input({ threadId, action: { kind: "move", x: 800, y: 0 } })
            .pipe(Effect.flip)).reason,
        ).toBe("bounds");
        expect(
          (yield* service
            .input({ threadId, action: { kind: "type", text: "Hello\n" } })
            .pipe(Effect.flip)).reason,
        ).toBe("invalid-input");
        yield* service.input({ threadId, action: { kind: "move", x: 799, y: 599 } });
        expect(inputs).toEqual(["test-vm"]);
        yield* service.release({ threadId });
        expect(
          (yield* service
            .input({ threadId, action: { kind: "key", key: "enter" } })
            .pipe(Effect.flip)).reason,
        ).toBe("not-connected");
      }).pipe(Effect.provide(LocalVmService.layer.pipe(Layer.provide(host))));
    },
  );
  it.effect("serializes concurrent grants and never clears pause on reconnect", () => {
    const host = Layer.succeed(LocalVmHost.LocalVmHost, {
      list: Effect.succeed({
        available: true,
        vms: [{ id: "test-vm", name: "Test VM", running: true }],
      }),
      screenshot: () =>
        Effect.succeed({ mimeType: "image/png" as const, data: "png", width: 800, height: 600 }),
      input: () => Effect.void,
    });
    return Effect.gen(function* () {
      const service = yield* LocalVmService.LocalVmService;
      const threadId = ThreadId.make("one");
      const results = yield* Effect.all(
        [
          Effect.result(service.connect({ threadId, vmId: "test-vm" })),
          Effect.result(service.connect({ threadId: ThreadId.make("two"), vmId: "test-vm" })),
        ],
        { concurrency: "unbounded" },
      );
      expect(results.map((r) => r._tag).sort()).toEqual(["Failure", "Success"]);
      const owner = (yield* service.list).sessions[0]!;
      yield* service.pause({ threadId: owner.threadId, paused: true });
      expect((yield* service.connect({ threadId: owner.threadId, vmId: "test-vm" })).paused).toBe(
        true,
      );
      yield* service.pause({ threadId: owner.threadId, paused: false });
      yield* service.input({ threadId: owner.threadId, action: { kind: "type", text: "Ready" } });
    }).pipe(Effect.provide(LocalVmService.layer.pipe(Layer.provide(host))));
  });
  it.effect("keeps an existing connection when a new VM cannot be observed", () => {
    const host = Layer.succeed(LocalVmHost.LocalVmHost, {
      list: Effect.succeed({
        available: true,
        vms: [
          { id: "good", name: "Good", running: true },
          { id: "broken", name: "Broken", running: true },
        ],
      }),
      screenshot: (vmId) =>
        vmId === "broken"
          ? Effect.fail(new LocalVmError({ reason: "operation-failed" }))
          : Effect.succeed({
              mimeType: "image/png" as const,
              data: "png",
              width: 800,
              height: 600,
            }),
      input: () => Effect.void,
    });
    return Effect.gen(function* () {
      const service = yield* LocalVmService.LocalVmService;
      const threadId = ThreadId.make("owner");
      yield* service.connect({ threadId, vmId: "good" });
      expect((yield* service.connect({ threadId, vmId: "broken" }).pipe(Effect.flip)).reason).toBe(
        "operation-failed",
      );
      expect((yield* service.screenshot({ threadId })).session.vmId).toBe("good");
    }).pipe(Effect.provide(LocalVmService.layer.pipe(Layer.provide(host))));
  });
});
