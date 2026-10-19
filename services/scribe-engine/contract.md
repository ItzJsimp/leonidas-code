# Scribe engine contract (v1.1)

v1.1 (2026-10-17, lane L1) is additive: v1 clients keep working and `apiVersion` stays `1`. New: `groqKey` and `privateMode` in status, the credentials commands, and `raw` and `engine` in the `transcript` event.

The engine is a Rust process. Leonidas Code supervises it and drives it over loopback HTTP. The contract is the only coupling ([ADR-0074](../../../../decisions/0074-leonidas-scribe-engine-moves-to-rust-and-python-leaves-the-product.md)). Any UI can drive the engine through it.

v1.3 (2026-10-18, lane L1) is additive too. New: `localModel` in status, and `engine: "local"` in the `transcript` event. The engine falls back to an on-device whisper.cpp model when the cloud cannot answer, and private mode uses only that model.

## Transport

- Bind `127.0.0.1` only, default port `8766`. Fail to start if the port is taken. The engine config (`%APPDATA%\Leonidas\scribe-engine\config.json`, field `port`) can change the port, for example to run next to Python Scribe.
- Reject any request with an `Origin` header or a `Host` other than `127.0.0.1:<port>` (403 `{"error":"forbidden"}`).
- All bodies are JSON (`Content-Type: application/json`). Responses carry `Cache-Control: no-store`.
- Every payload carries `"service":"leonidas-scribe"` and `"apiVersion":1`.
- Error body: `{"error":"<code>"}`. Codes: `forbidden`, `not_found`, `method_not_allowed`, `bad_request`, `status_unavailable`, `invalid_state`, `store_error` (v1.1: 500 when the OS credential store fails; no detail is returned).

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
  "sampledAt": "2026-10-15T01:00:00.000Z",
  "groqKey": true,
  "privateMode": false,
  "localModel": "absent"
}
```

- `groqKey` (v1.1): a Groq key is stored, or `GROQ_API_KEY` is set. The key itself is never returned.
- `privateMode` (v1.1): audio never leaves the device.
- `localModel` (v1.3, optional): the offline model, `absent`, `downloading` or `ready`. It downloads once (about 60 MB) the first time it is needed and is not in the installer.

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

### `PUT /v1/credentials/groq` (v1.1)

Store the user's Groq key in the OS credential store (Windows Credential Manager, macOS Keychain).

```json
{ "key": "gsk_..." }
```

Reply: `204 No Content`. An empty or missing `key` is 400 `bad_request`. The engine never writes the key to a file or a log.

### `DELETE /v1/credentials/groq` (v1.1)

Remove the stored key. Reply: `204 No Content`, also when no key was stored.

## Events

### `GET /v1/events`

Server-sent events (`text/event-stream`). One JSON object per `data:` line. Each event also carries `service` and `apiVersion` (left out of the examples below). A `: ping` comment arrives every 15 s. Types:

```json
{"type":"state","state":"listening","at":"2026-10-15T01:00:00.000Z"}
{"type":"partial","text":"hello wor","at":"2026-10-15T01:00:01.000Z"}
{"type":"transcript","text":"Hello world.","raw":"hello world","durationMs":1840,"pasted":true,"engine":"groq","at":"2026-10-15T01:00:03.000Z"}
{"type":"error","code":"mic_error","message":"No input device","at":"2026-10-15T01:00:00.000Z"}
```

- `transcript.text` is the polished text that was pasted. `raw` (v1.1) is the speech-to-text output before polish. `engine` (v1.1) is `groq` or `local`.
- Error codes: `mic_error` (no device or capture failed), `stt_error` (speech-to-text failed; the state returns to `ready`).
- A v1 reader ignores the new fields; a v1.1 reader treats a missing `raw` as `""` and a missing `engine` as `groq`.

## Budgets

Hotkey to recording under 50 ms. Idle RAM under 30 MB. CI fails the build on a miss.
