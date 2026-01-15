const prefetchedKeys = new Set<string>();

export type PrefetchEntry = {
  key: string;
  loader: () => Promise<unknown>;
};

function runPrefetch(entries: PrefetchEntry[]) {
  for (const entry of entries) {
    if (!entry || prefetchedKeys.has(entry.key)) continue;
    prefetchedKeys.add(entry.key);
    entry.loader().catch(() => {
      prefetchedKeys.delete(entry.key);
    });
  }
}

export function schedulePrefetch(entries?: PrefetchEntry[]) {
  if (
    !entries ||
    entries.length === 0 ||
    typeof window === "undefined" ||
    entries.every((entry) => !entry?.loader)
  ) {
    return;
  }

  const callback = () => runPrefetch(entries);

  const idleCallback =
    typeof window !== "undefined" && window.requestIdleCallback
      ? window.requestIdleCallback
      : undefined;

  if (idleCallback) {
    idleCallback(callback, { timeout: 2000 });
  } else {
    setTimeout(callback, 500);
  }
}
