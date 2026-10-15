# Resilience Engineering Principles for Automations

Automations must be predictable, idempotent, and self-healing. A brittle automation that fails silently or multiplies errors causes more operational damage than manual work.

---

## 1. Idempotency & Deduplication Patterns

Idempotency guarantees that executing an automation multiple times with the same input produces the exact same outcome without duplicate side effects.

### Stripe-Style Response Caching

For API calls and webhooks:

1. The client or caller generates a high-entropy key (e.g. UUIDv4 or deterministic hash of payload: `SHA256(timestamp_bucket + payload)`).
2. The automation checks a local cache or SQLite table (`idempotency_keys`) before processing.
3. If the key exists, return the cached result immediately without re-executing.
4. If the key is new, execute the transformation, cache the result, and set a 24-hour TTL.

### Azure Idempotent Consumer Pattern (Atomic Commit)

When processing messages or queue items:

- **The Golden Rule:** The deduplication marker and the actual side effect must commit in the **same atomic transaction**.
- If committed separately, a crash between the action and the marker write causes the message to be reprocessed on restart, resulting in double-application.
- Never deduplicate on transport-generated IDs that change on redelivery; use a stable domain identifier (e.g. `order_id`, `task_id`, `git_commit_sha`).

---

## 2. Retries vs. Circuit Breakers

Retries and circuit breakers solve two different problems and must be used together.

### The Retry Pattern (Transient Faults Only)

- Retries exist **only** for faults expected to resolve in seconds (e.g. network blip, HTTP 429 rate limit, database lock).
- Never retry permanent errors (HTTP 400, 401, 403, 404, schema validation failures).
- Always use **Exponential Backoff with Full Jitter**:
  ```text
  sleep_time = min(cap, base * 2^attempt) + random_uniform(0, jitter)
  ```

### The Circuit Breaker Pattern (Cascading Failure Protection)

- _The Risk:_ Google SRE incident data shows naive retries amplify outages: 100 QPS of failing requests quickly cascades into 300+ QPS as retries flood a struggling dependency.
- _The Fix:_ Implement a 3-state machine per external dependency:
  - **Closed (Normal):** Requests pass through. Track failure count within a rolling window.
  - **Open (Failing):** Once failures exceed threshold (e.g. 5 consecutive errors), immediately fail fast without calling the remote dependency. Save resources and prevent retry storms.
  - **Half-Open (Testing Recovery):** After a cooldown period (e.g. 60 seconds), allow 1 trial request through. If it succeeds, reset to Closed. If it fails, return to Open.

---

## 3. State Machines & Checkpoint Persistence

For multi-step batch automations or long-running jobs:

1. **Never Rely on In-Memory State:** An unhandled exception or Windows reboot silently wipes in-memory variables.
2. **Append-Only State Ledger:** Record state transitions to a simple file or SQLite table:
   ```json
   {
     "job_id": "batch-104",
     "step": "extract",
     "status": "completed",
     "timestamp": "2026-09-12T18:00:00"
   }
   ```
3. **Replay-Safe Resume:** On restart, read the ledger, identify the last verified step, and resume forward rather than re-running from step 1.

---

## 4. Observability: Heartbeats & Dead-Man Switches

Traditional logging records errors. But the most common failure in scheduled automation is **absence of execution** (task hung, scheduler disabled, PC offline).

- **Inverted Alerting (Dead-Man Switch):**
  - The job sends a simple HTTP ping or file timestamp update upon completion.
  - An external monitoring service or local watchdog alerts only when an expected heartbeat **fails to arrive** within its scheduled grace window.
- **Local AIOS Watchdog:**
  - AIOS scripts write last-run timestamps into `logs/telemetry/`.
  - `scripts/Audit-Substrate.ps1` checks for stale timestamps (>24 hours past schedule) during routine audits.

---

## 5. Autonomous Agent Loop Guardrails (Anthropic Standard)

When running Tier 3 agent loops (Antigravity background tasks or Claude Code routines):

1. **Explicit Iteration & Token Caps:** Set hard bounds in prompt or runtime (e.g. max 5 tool turns, max 100k context).
2. **Deterministic "When to Stop" Criteria:** Provide explicit conditions: "Stop as soon as tests pass; do not continue searching for alternative solutions."
3. **External Memory Checkpoint:** Persist progress to a scratch file every 3 steps. If context degrades, spawn a fresh agent reading the checkpoint rather than dragging a 150k token context snowball.
4. **Runnable Verification Gate:** An agent loop must never stop on "looks completed." It must run a mechanical test, compile check, or AST lint to verify success.
