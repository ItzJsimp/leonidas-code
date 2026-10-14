import type { EnvironmentId } from "@t3tools/contracts";
import {
  type AutoRouteCandidate,
  type BenchmarkRouteProfiles,
  profileModel,
} from "@t3tools/shared/autoRouter";
import { benchmarkRouteProfiles } from "@t3tools/shared/modelBenchmarkMatch";
import { useMemo } from "react";

import { useEnvironmentQuery } from "../state/query";
import { serverEnvironment } from "../state/server";

/**
 * Router profiles measured from public benchmarks for the candidates' models.
 * Fetches the (server-cached) catalog only while the autorouter is on; until
 * it arrives the router keeps its family guesses.
 */
export function useBenchmarkRouteProfiles(
  environmentId: EnvironmentId | null,
  candidates: ReadonlyArray<AutoRouteCandidate>,
  enabled: boolean,
): BenchmarkRouteProfiles | undefined {
  const catalog = useEnvironmentQuery(
    enabled && environmentId
      ? serverEnvironment.modelBenchmarkCatalog({ environmentId, input: {} })
      : null,
  ).data;
  return useMemo(() => {
    if (!catalog) return undefined;
    const slugs = candidates.flatMap((candidate) => candidate.models.map((model) => model.slug));
    return benchmarkRouteProfiles(catalog.entries, slugs, (slug) => profileModel(slug));
  }, [catalog, candidates]);
}
