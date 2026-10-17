/**
 * The engine listens on loopback only. `LEONIDAS_SCRIBE_ENGINE_PORT` moves it,
 * so a dev server can talk to the mock engine while Python Scribe holds 8766.
 */
export const scribeEngineBaseUrl = (env: NodeJS.ProcessEnv = process.env): string => {
  const port = Number(env.LEONIDAS_SCRIBE_ENGINE_PORT);
  const valid = Number.isInteger(port) && port > 0 && port < 65536;
  return `http://127.0.0.1:${valid ? port : 8766}`;
};
