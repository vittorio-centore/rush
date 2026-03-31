"use client";

import { useEffect, useRef } from "react";

import { postBrowserEvent } from "@/lib/events";

type Props = {
  q?: string;
  resultCount: number;
};

export default function DirectoryEventReporter({ q, resultCount }: Props) {
  const loggedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!q) {
      return;
    }

    const trimmed = q.trim();
    if (!trimmed) {
      return;
    }

    const key = `${trimmed}:${resultCount}`;
    if (loggedKey.current === key) {
      return;
    }

    loggedKey.current = key;

    void postBrowserEvent({
      eventType: "search",
      metadata: {
        surface: "club_directory",
        query: trimmed,
        result_count: resultCount,
      },
    });
  }, [q, resultCount]);

  return null;
}
