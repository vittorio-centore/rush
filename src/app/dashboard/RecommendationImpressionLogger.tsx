"use client";

import { useEffect, useRef } from "react";

import { postBrowserEvent } from "@/lib/events";

type Props = {
  clubIds: string[];
  modelVersion: string;
  strategy: string;
};

export default function RecommendationImpressionLogger({
  clubIds,
  modelVersion,
  strategy,
}: Props) {
  const hasLogged = useRef(false);

  useEffect(() => {
    if (hasLogged.current || clubIds.length === 0) {
      return;
    }

    hasLogged.current = true;

    void postBrowserEvent({
      eventType: "recommendation_impression",
      metadata: {
        surface: "dashboard_recommendations",
        model_version: modelVersion,
        strategy,
        club_ids: clubIds,
      },
    });
  }, [clubIds, modelVersion, strategy]);

  return null;
}
