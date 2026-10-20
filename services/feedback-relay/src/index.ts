import { handleCommunity, isCommunityPath, type CommunityEnv } from "./community";
import { handleRequest } from "./relay";

export default {
  fetch: (request: Request, env: CommunityEnv) =>
    isCommunityPath(new URL(request.url).pathname)
      ? handleCommunity(request, env)
      : handleRequest(request, env),
};
