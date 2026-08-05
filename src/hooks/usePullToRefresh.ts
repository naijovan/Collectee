/**
 * Wires an existing `load()` to a `RefreshControl`.
 *
 * Home, Collections and Explore all already re-run `load()` on focus, so the
 * data seam was there — what was missing was any way for the user to *ask*.
 * An app whose lists cannot be pulled reads as a prototype, and it is the first
 * thing a demo audience tries when a number looks stale.
 *
 * The refreshing flag is deliberately separate from each screen's `busy`:
 * `busy` swaps the content for skeletons, which is right on first load and
 * wrong on a refresh — the user is looking at the list they just pulled and it
 * should stay on screen while the spinner runs.
 *
 * Usage:
 *
 *     const { refreshing, onRefresh } = usePullToRefresh(load);
 *     <ScrollView refreshControl={<RefreshControl … />}>
 */

import { useCallback, useState } from 'react';

export function usePullToRefresh(load: () => Promise<void>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    /* `finally`, not `then`: a load that throws must still release the spinner,
       otherwise the list is stuck under a permanent one. */
    void load().finally(() => setRefreshing(false));
  }, [load]);

  return { refreshing, onRefresh };
}
