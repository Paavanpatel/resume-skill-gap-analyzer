"use client";

import { useEffect } from "react";

/**
 * Sets the document title for client-side pages.
 * Uses the template pattern: "{title} | RSGA"
 */
export default function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | RSGA`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
