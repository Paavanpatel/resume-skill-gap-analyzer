"use client";

import { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from "react";

type Politeness = "polite" | "assertive";

interface Announcement {
  message: string;
  politeness: Politeness;
}

interface LiveAnnouncerContextValue {
  announce: (message: string, politeness?: Politeness) => void;
}

const LiveAnnouncerContext = createContext<LiveAnnouncerContextValue>({
  announce: () => {},
});

export function useLiveAnnouncer() {
  return useContext(LiveAnnouncerContext);
}

interface LiveAnnouncerProviderProps {
  children: ReactNode;
}

export function LiveAnnouncerProvider({ children }: LiveAnnouncerProviderProps) {
  const [announcement, setAnnouncement] = useState<Announcement>({
    message: "",
    politeness: "polite",
  });

  const announce = useCallback((message: string, politeness: Politeness = "polite") => {
    // Clear first to ensure re-announcement of same message
    setAnnouncement({ message: "", politeness });
    requestAnimationFrame(() => {
      setAnnouncement({ message, politeness });
    });
  }, []);

  return (
    <LiveAnnouncerContext.Provider value={{ announce }}>
      {children}
      <div
        data-testid="live-announcer"
        aria-live={announcement.politeness}
        aria-atomic="true"
        role="status"
        className="sr-only"
      >
        {announcement.message}
      </div>
    </LiveAnnouncerContext.Provider>
  );
}

export default LiveAnnouncerProvider;
