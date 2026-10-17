# Scribe engine contract (v1)

The engine is a Rust process. Leonidas Code supervises it and drives it over loopback HTTP. The contract is the only coupling ([ADR-0074](../../../../decisions/0074-leonidas-scribe-engine-moves-to-rust-and-python-leaves-the-product.md)). Any UI can drive the engine through it.

## Transport

- Bind `127.0.0.1` only, default port `8766`. Fail to start if the port is taken.
- Reject any request with an `Origin` header or a `Host` other than `127.0.0.1:<port>` (403 `{"error":"forbidden"}`).
- All bodies are JSON (`Content-Type: application/json`). Responses carry `Cache-Control: no-store`.
- Every payload carries `"service":"leonidas-scribe"` and `"apiVersion":1`.
- Error body: `{"error":"<code>"}`. Codes: `forbidden`, `not_found`, `method_not_allowed`, `bad_request`, `status_unavailable`, `invalid_state`.

## States

`ready`, `listening`, `processing`, `mic_error`. This is the same set as `projects/leonidas-scribe/status_api.py`.

## Commands

### `GET /v1/status`

Matches the old Python API. 503 `status_unavailable` if no sample is under 5 s old.

```json
{
  "service": "leonidas-scribe",
  "apiVersion": 1,
  "state": "ready",
  "sampledAt": "2026-10-15T01:00:00.000Z"
}
```

### `POST /v1/start`

Start recording. Allowed in `ready` only; otherwise 409 `invalid_state`.

```json
{ "mode": "hold" }
```

Reply: `{"service":"leonidas-scribe","apiVersion":1,"state":"listening"}`. `mode` is `hold` or `toggle`.

### `POST /v1/stop`

Stop recording and start transcription. Allowed in `listening` only.

```json
{ "paste": true }
```

Reply: `{"service":"leonidas-scribe","apiVersion":1,"state":"processing"}`. When `paste` is true, the engine pastes the final text into the focused window.

## Events

### `GET /v1/events`

Server-sent events (`text/event-stream`). One JSON object per `data:` line. Types:

```json
{"type":"state","state":"listening","at":"2026-10-15T01:00:00.000Z"}
{"type":"partial","text":"hello wor","at":"2026-10-15T01:00:01.000Z"}
{"type":"transcript","text":"Hello world.","durationMs":1840,"pasted":true,"at":"2026-10-15T01:00:03.000Z"}
{"type":"error","code":"mic_error","message":"No input device","at":"2026-10-15T01:00:00.000Z"}
```

## Budgets

Hotkey to recording under 50 ms. Idle RAM under 30 MB. CI fails the build on a miss.
