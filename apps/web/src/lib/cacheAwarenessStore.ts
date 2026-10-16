import { useSyncExternalStore } from "react";
import type { CacheNoticeRecord, CacheObservation } from "@t3tools/client-runtime/cache-awareness";

export const recentCacheChats = new Map<string, CacheNoticeRecord>();
let now = Date.now();
let snoozedForSession = false;
const listeners = new Set<() => void>();
export const cacheClock = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  read: () => now,
  tick(time = Date.now()) {
    now = time;
    for (const listener of listeners) listener();
  },
};
export function useCacheClock() {
  return useSyncExternalStore(cacheClock.subscribe, cacheClock.read, cacheClock.read);
}
export function observeCacheChat(key: string, observation: CacheObservation, viewedAt: number) {
  const previous = recentCacheChats.get(key);
  recentCacheChats.delete(key);
  recentCacheChats.set(key, {
    key,
    observation,
    lastViewedAt: viewedAt,
    notifiedCycle: previous?.notifiedCycle ?? null,
  });
  while (recentCacheChats.size > 100)
    recentCacheChats.delete(recentCacheChats.keys().next().value!);
}
export function setCacheSessionSnooze(value: boolean) {
  snoozedForSession = value;
  cacheClock.tick();
}
export function isCacheSessionSnoozed() {
  return snoozedForSession;
}
