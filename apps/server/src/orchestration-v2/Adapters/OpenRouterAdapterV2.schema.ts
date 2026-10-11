/**
 * NATIVE OPENROUTER ADAPTER SCHEMA (Stage 2 scaffold — not full streaming yet)
 * Direct OpenAI-compatible API at https://openrouter.ai/api/v1/chat/completions
 * No Claude CLI dependency. Uses HTTP client directly.
 *
 * @module openrouter/Adapters/OpenRouterAdapterV2
 */
export const SCHEMA = {
  driverKind: "openrouter",
  endpoint: "https://openrouter.ai/api/v1",
  requires: ["apiKey"],
  capabilities: { fork: false, rollback: false, steer: false, subagents: false, historyInjection: false },
};
// Full adapter requires: ProviderAdapterV2 interface (openSession, startTurn, etc.)
// with streaming response parsing (text/event-stream) and checkpoint integration.
// Deferred to stage 3; scaffold records the contract.
