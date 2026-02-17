import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * Monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 * Suppresses the initial mount to avoid a false "back online" on page load.
 */
export function useNetworkStatus() {
  const isOnline = useOnlineStatus();
  const hasBeenOffline = useRef(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the very first render to avoid false "back online" on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // If already offline on mount, show the notification
      if (!isOnline) {
        hasBeenOffline.current = true;
        toast.warning("You are offline", {
          description: "Changes will be saved locally and synced when you reconnect.",
          duration: Infinity,
          id: "network-status",
        });
      }
      return;
    }

    if (!isOnline) {
      hasBeenOffline.current = true;
      toast.warning("You are offline", {
        description: "Changes will be saved locally and synced when you reconnect.",
        duration: Infinity,
        id: "network-status",
      });
    } else if (hasBeenOffline.current) {
      hasBeenOffline.current = false;
      toast.success("Back online", {
        description: "Your connection has been restored. Syncing changes...",
        duration: 4000,
        id: "network-status",
      });
    }
  }, [isOnline]);
}
