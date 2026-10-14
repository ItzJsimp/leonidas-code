import { handleRequest, type RelayEnv } from "./relay";

export default {
  fetch: (request: Request, env: RelayEnv) => handleRequest(request, env),
};
