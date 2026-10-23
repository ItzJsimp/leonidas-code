import { AuthFilesystemWriteScope, type MarketingListResult, WS_METHODS } from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "../../connection/runtime";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useEnvironmentQuery } from "../../state/query";
import { useEnvironmentScope } from "../../state/session";

export const marketingListQuery = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:marketing:list",
  tag: WS_METHODS.marketingList,
  staleTimeMs: 15_000,
  idleTtlMs: 5 * 60_000,
  refreshIntervalMs: 30_000,
});

export const marketingDecide = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-data:marketing:decide",
  tag: WS_METHODS.marketingDecide,
});

export interface MarketingView {
  readonly environmentId: ReturnType<typeof usePrimaryEnvironmentId>;
  readonly list: MarketingListResult | null;
  readonly error: string | null;
  readonly refresh: () => void;
  /** Only a person's session holds this. An agent access level never does. */
  readonly canDecide: boolean;
}

/** The Marketing data of the open workspace, refreshed every 30 s. */
export function useMarketing(): MarketingView {
  const environmentId = usePrimaryEnvironmentId();
  const query = useEnvironmentQuery(
    environmentId ? marketingListQuery({ environmentId, input: {} }) : null,
  );
  const canDecide = useEnvironmentScope(environmentId, AuthFilesystemWriteScope);
  return {
    environmentId,
    list: query.data,
    error: query.error,
    refresh: query.refresh,
    canDecide,
  };
}

/** True when nothing is set up yet, so the home page can hide the card. */
export const isUnused = (list: MarketingListResult) =>
  list.brands.length === 0 && list.posts.length === 0 && list.bad.length === 0;

/** The count the header stat shows; null hides it. */
export function useNeedsApprovalCount(): number | null {
  const { list } = useMarketing();
  return list && list.queueTotal > 0 ? list.queueTotal : null;
}
