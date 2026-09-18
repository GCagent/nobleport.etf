/**
 * Kuzo Platform — useMetrics React Query Hook
 *
 * Polls the /metrics endpoint every 30 seconds.
 * Stops polling when the browser tab is hidden.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchMetrics, KuzoMetricSnapshot } from "../api/metrics";

const POLL_INTERVAL_MS = 30_000;

export function useMetrics() {
  return useQuery<KuzoMetricSnapshot, Error>({
    queryKey: ["kuzo-metrics"],
    queryFn: fetchMetrics,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false, // stop when tab is hidden
    staleTime: POLL_INTERVAL_MS - 2_000, // consider data stale 2 s before next poll
  });
}
