import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { HttpClient, HttpClientResponse } from "effect/http";

import { ServerSecretStore } from "../auth/ServerSecretStore.ts";
import { ExternalLauncher } from "../process/externalLauncher.ts";
import * as Calendar from "./Calendar.ts";

const SECRET_PATH = "private-TOPSECRET9876";
const LINK = `webcal://calendar.example.com/ical/${SECRET_PATH}/basic.ics`;
const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:a",
  "DTSTART:20260310T150000Z",
  "DTEND:20260310T160000Z",
  "SUMMARY:Planning",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:b",
  "DTSTART:20260311T150000Z",
  "SUMMARY:Review",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");
const WINDOW = { from: "2026-03-01T00:00:00Z", to: "2026-04-01T00:00:00Z" };

const makeHarness = () => {
  const calls: string[] = [];
  let reply: () => Response = () => new Response(ICS);
  const http = HttpClient.make((request) => {
    calls.push(request.url);
    return Effect.succeed(HttpClientResponse.fromWeb(request, reply()));
  });
  const files = new Map<string, Uint8Array>();
  const secrets = ServerSecretStore.of({
    get: (name) => Effect.sync(() => Option.fromNullishOr(files.get(name))),
    set: (name, value) => Effect.sync(() => void files.set(name, value)),
    create: (name, value) => Effect.sync(() => void files.set(name, value)),
    getOrCreateRandom: () => Effect.succeed(new Uint8Array()),
    remove: (name) => Effect.sync(() => void files.delete(name)),
  });
  const launcher = ExternalLauncher.of({
    resolveAvailableEditors: () => Effect.succeed([]),
    resolveFileManagerRevealKind: () => Effect.succeed(undefined),
    launchBrowser: () => Effect.void,
    launchEditor: () => Effect.void,
  });
  const layer = Calendar.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(HttpClient.HttpClient, http),
        Layer.succeed(ServerSecretStore, secrets),
        Layer.succeed(ExternalLauncher, launcher),
      ),
    ),
  );
  return { calls, layer, reply: (next: () => Response) => (reply = next) };
};

describe("Calendar", () => {
  it.effect("tests, saves and reads a link, and never sends the link back", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      const tested = yield* calendar.testLink(LINK);
      expect(tested).toMatchObject({ ok: true, message: "Found 2 events.", eventCount: 2 });
      expect(harness.calls[0]).toBe(`https://calendar.example.com/ical/${SECRET_PATH}/basic.ics`);

      const added = yield* calendar.addLink({ url: LINK, name: "  Team  ", color: "#34a853" });
      expect(added.ok).toBe(true);

      const result = yield* calendar.events(WINDOW);
      expect(result.events.map((e) => e.title)).toEqual(["Planning", "Review"]);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0]).toMatchObject({ kind: "ics", name: "Team", color: "#34a853" });
      expect(JSON.stringify(result) + JSON.stringify(added) + JSON.stringify(tested)).not.toContain(
        "TOPSECRET",
      );
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("keeps a read for 15 minutes, unless the caller asks for a refresh", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      yield* calendar.addLink({ url: LINK, name: "", color: "" });
      const afterAdd = harness.calls.length;

      yield* calendar.events(WINDOW);
      yield* calendar.events(WINDOW);
      expect(harness.calls.length).toBe(afterAdd + 1);

      yield* TestClock.adjust("14 minutes");
      yield* calendar.events(WINDOW);
      expect(harness.calls.length).toBe(afterAdd + 1);

      yield* TestClock.adjust("2 minutes");
      yield* calendar.events(WINDOW);
      expect(harness.calls.length).toBe(afterAdd + 2);

      yield* calendar.events({ ...WINDOW, refresh: true });
      expect(harness.calls.length).toBe(afterAdd + 3);
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("refuses bad links before any request, and says why in plain words", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      for (const bad of ["", "ftp://x.example.com/a.ics", "file:///etc/passwd", "hello"]) {
        const result = yield* calendar.testLink(bad);
        expect(result.ok).toBe(false);
      }
      expect(harness.calls).toHaveLength(0);

      harness.reply(() => new Response("<html>login</html>"));
      expect((yield* calendar.testLink(LINK)).message).toContain("did not return a calendar");

      harness.reply(() => new Response("", { status: 404 }));
      expect((yield* calendar.testLink(LINK)).message).toContain("not found");

      harness.reply(
        () => new Response("x", { headers: { "content-length": String(50 * 1024 * 1024) } }),
      );
      expect((yield* calendar.testLink(LINK)).message).toContain("too big");
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("stops reading a body that grows past the size cap", () => {
    const harness = makeHarness();
    harness.reply(() => new Response(`BEGIN:VCALENDAR\r\n${"X".repeat(6 * 1024 * 1024)}`));
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      expect((yield* calendar.testLink(LINK)).message).toContain("too big");
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect("reports a failing source without the link and recovers on refresh", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      yield* calendar.addLink({ url: LINK, name: "Team", color: "" });
      harness.reply(() => new Response("", { status: 500 }));
      const failed = yield* calendar.events({ ...WINDOW, refresh: true });
      expect(failed.events).toHaveLength(0);
      expect(failed.sources[0]?.error).toContain("sent an error");
      expect(JSON.stringify(failed)).not.toContain("TOPSECRET");

      harness.reply(() => new Response(ICS));
      const healed = yield* calendar.events({ ...WINDOW, refresh: true });
      expect(healed.events).toHaveLength(2);
      expect(healed.sources[0]?.error).toBeUndefined();
    }).pipe(Effect.provide(harness.layer));
  });

  it.effect(
    "rejects a repeat link, removes a calendar, and keeps Google off without a client ID",
    () => {
      const harness = makeHarness();
      return Effect.gen(function* () {
        const calendar = yield* Calendar.Calendar;
        yield* calendar.addLink({ url: LINK, name: "Team", color: "" });
        expect(
          (yield* calendar.addLink({ url: LINK, name: "Again", color: "" })).message,
        ).toContain("already");

        const listed = yield* calendar.events(WINDOW);
        expect(listed.googleReady).toBe(false);
        const connect = yield* calendar.googleConnect;
        expect(connect).toMatchObject({ ok: false, calendars: [] });

        yield* calendar.remove(listed.sources[0]?.id ?? "");
        expect((yield* calendar.events(WINDOW)).sources).toHaveLength(0);
      }).pipe(Effect.provide(harness.layer));
    },
  );

  it.effect("accepts a Google client ID only in the right shape", () => {
    const harness = makeHarness();
    return Effect.gen(function* () {
      const calendar = yield* Calendar.Calendar;
      expect((yield* calendar.googleSetClient({ clientId: "nope", clientSecret: "" })).ok).toBe(
        false,
      );
      expect(
        (yield* calendar.googleSetClient({
          clientId: "123-abc.apps.googleusercontent.com",
          clientSecret: "s",
        })).ok,
      ).toBe(true);
      expect((yield* calendar.events(WINDOW)).googleReady).toBe(true);
    }).pipe(Effect.provide(harness.layer));
  });
});
