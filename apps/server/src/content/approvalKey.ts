import * as Effect from "effect/Effect";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

/** The secrets-store name of the key that signs script approvals. It is made on first use. */
export const CONTENT_APPROVAL_KEY_NAME = "content-approval-key";

export const contentApprovalKey = Effect.flatMap(ServerSecretStore.ServerSecretStore, (store) =>
  store.getOrCreateRandom(CONTENT_APPROVAL_KEY_NAME, 32),
);
