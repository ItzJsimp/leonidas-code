# Voice input

Transcription edits a composer draft. It does not submit an agent turn. Audio is
temporary client input, and only normal message submission sends the resulting
text. Supported iOS devices transcribe locally through the shared controller.
Web and desktop composer dictation use environment-backed Groq transcription.

The web capture path lives in `apps/web/src/components/voice/`. Its server service
is `apps/server/src/scribe/VoiceDictation.ts`. RPC contracts live in
`packages/contracts/src/voice.ts`. The Voice wizard step follows AI account setup.
It includes key setup, a spoken test, and an explicit skip.

`VoiceKeyStore.ts` uses the OS credential vault, scoped to the host state directory.
It has no plaintext fallback. `ServerSecretStore` stores file bytes and does not
provide encryption. Audio is capped at 8 MiB and ten minutes. Groq Whisper produces
the transcript; a separate cleanup call uses `openai/gpt-oss-20b`. Cleanup failures
keep the raw transcript. Model availability must be checked before a release.

In-window capture does not replace the always-on Scribe engine or its global hotkey.
The web capture path currently owns its lifecycle separately from the shared iOS
controller. Review both paths before extending draft ownership or cancellation.

The [shared controller](../../packages/client-runtime/src/voice-input/controller.ts)
owns the operation while the client supplies capture and transcription. Preparation
binds the transcriber and resolved locale for the whole recording. Draft ownership,
text, and revision are captured before recording and checked before insertion, so
a late transcript cannot overwrite a draft that was edited or replaced.

Cancellation invalidates a result immediately, but resources stay owned until the
underlying work settles. Apple's native transcription call cannot be interrupted
once started. Releasing the session or deleting its recording when the abort signal
fires would race that work. The [transcription contract](../../packages/client-runtime/src/voice-input/transcription.ts)
therefore requires implementations to settle only after their work has stopped;
the [Apple binding](../../apps/mobile/src/native/voiceTranscription.ios.ts) checks
cancellation between native calls and discards late results.
