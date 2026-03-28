"use client";

import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OfflineBanner — renders a sticky top banner when the browser
 * loses network connectivity, then slides away when it reconnects.
 *
 * Uses the standard `navigator.onLine` + online/offline events.
 * Mounted in the root layout so it covers every route.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);
  // Ref avoids adding wasOffline to the effect dependency array,
  // which would cause event listeners to be torn down and re-added
  // every time the user first goes offline.
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    // Initialise from current browser state
    if (!navigator.onLine) {
      setIsOffline(true);
      wasOfflineRef.current = true;
    }

    function handleOffline() {
      setIsOffline(true);
      wasOfflineRef.current = true;
      setShowReconnected(false);
    }

    function handleOnline() {
      setIsOffline(false);
      if (wasOfflineRef.current) {
        setShowReconnected(true);
        // Hide the "back online" flash after 3 s
        setTimeout(() => setShowReconnected(false), 3000);
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-transform duration-300",
        isOffline
          ? "bg-danger-600 text-white"
          : "bg-success-600 text-white"
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>You&apos;re offline — some features may be unavailable.</span>
        </>
      ) : (
        <span>Back online!</span>
      )}
    </div>
  );
}
