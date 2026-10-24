import * as Schema from "effect/Schema";

import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** A calendar colour as `#rrggbb`. The picker offers a fixed set; the server checks the shape. */
export const CalendarColor = Schema.String.check(Schema.isPattern(/^#[0-9a-fA-F]{6}$/));

export const CalendarSourceView = Schema.Struct({
  id: TrimmedNonEmptyString,
  kind: Schema.Literals(["ics", "google"]),
  name: Schema.String,
  color: CalendarColor,
  /** Masked hint such as `calendar.google.com/...a1b2`. The full link never leaves the server. */
  hint: Schema.String,
  /** When the last read worked. Absent until the first read. */
  lastSyncAt: Schema.optional(IsoDateTime),
  /** Plain words for the last failure. Absent when the last read worked. */
  error: Schema.optional(Schema.String),
});
export type CalendarSourceView = typeof CalendarSourceView.Type;

export const CalendarEvent = Schema.Struct({
  id: Schema.String,
  sourceId: Schema.String,
  title: Schema.String,
  start: IsoDateTime,
  end: IsoDateTime,
  allDay: Schema.Boolean,
  location: Schema.optional(Schema.String),
  /** A meeting link (Meet, Zoom, Teams, Webex) when the event has one. */
  joinUrl: Schema.optional(Schema.String),
});
export type CalendarEvent = typeof CalendarEvent.Type;

/** Events that start inside `[from, to)`. `refresh` skips the 15 minute cache. */
export const CalendarEventsInput = Schema.Struct({
  from: IsoDateTime,
  to: IsoDateTime,
  refresh: Schema.optionalKey(Schema.Boolean),
});
export type CalendarEventsInput = typeof CalendarEventsInput.Type;

export const CalendarEventsResult = Schema.Struct({
  events: Schema.Array(CalendarEvent),
  sources: Schema.Array(CalendarSourceView),
  /** True when a Google client ID is set, so "Sign in with Google" can work. */
  googleReady: Schema.Boolean,
});
export type CalendarEventsResult = typeof CalendarEventsResult.Type;

export const CalendarLinkInput = Schema.Struct({ url: Schema.String });
export type CalendarLinkInput = typeof CalendarLinkInput.Type;

export const CalendarAddLinkInput = Schema.Struct({
  url: Schema.String,
  name: Schema.String,
  color: Schema.String,
});
export type CalendarAddLinkInput = typeof CalendarAddLinkInput.Type;

/** Every calendar action answers in plain words. `message` never contains a link or token. */
export const CalendarActionResult = Schema.Struct({
  ok: Schema.Boolean,
  message: Schema.String,
  eventCount: Schema.optional(Schema.Number),
});
export type CalendarActionResult = typeof CalendarActionResult.Type;

export const CalendarRemoveInput = Schema.Struct({ id: Schema.String });
export type CalendarRemoveInput = typeof CalendarRemoveInput.Type;

export const CalendarGoogleClientInput = Schema.Struct({
  clientId: Schema.String,
  clientSecret: Schema.String,
});
export type CalendarGoogleClientInput = typeof CalendarGoogleClientInput.Type;

export const CalendarGoogleCalendar = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  color: CalendarColor,
});
export type CalendarGoogleCalendar = typeof CalendarGoogleCalendar.Type;

/** Opens Google in the browser on the server's computer and waits for the user to allow access. */
export const CalendarGoogleConnectResult = Schema.Struct({
  ok: Schema.Boolean,
  message: Schema.String,
  calendars: Schema.Array(CalendarGoogleCalendar),
});
export type CalendarGoogleConnectResult = typeof CalendarGoogleConnectResult.Type;

export const CalendarGoogleSelectInput = Schema.Struct({
  calendars: Schema.Array(CalendarGoogleCalendar),
});
export type CalendarGoogleSelectInput = typeof CalendarGoogleSelectInput.Type;
