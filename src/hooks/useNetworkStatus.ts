import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Monitors network connectivity and shows toast notifications
 * when the user goes offline or comes back online.
 * Suppresses the initial mount to avoid a false "back online" on page load.
 */
export function useNetworkStatus() {
  const hasBeenOffline = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      hasBeenOffline.current = true;
      toast.warning("You are offline", {
        description: "Changes will be saved locally and synced when you reconnect.",
        duration: Infinity,
        id: "network-status",
      });
    };

    const handleOnline = () => {
      // Only show "back online" if user was actually offline during this session
      if (hasBeenOffline.current) {
        hasBeenOffline.current = false;
        toast.success("Back online", {
          description: "Your connection has been restored. Syncing changes...",
          duration: 4000,
          id: "network-status",
        });
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // If already offline on mount, show the notification
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
