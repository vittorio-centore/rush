"use client";

import { useOptimistic, useTransition } from "react";
import { followClub, unfollowClub } from "./actions";

type Props = {
  clubId: string;
  isFollowing: boolean;
};

export default function FollowButton({ clubId, isFollowing }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimisticFollowing, setOptimisticFollowing] = useOptimistic(isFollowing);

  function handleClick() {
    startTransition(async () => {
      setOptimisticFollowing(!optimisticFollowing);
      if (optimisticFollowing) {
        await unfollowClub(clubId);
      } else {
        await followClub(clubId);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        optimisticFollowing
          ? "border border-border-warm bg-white text-ink hover:border-status-rejected/30 hover:bg-red-50 hover:text-status-rejected"
          : "border border-brand-action bg-brand-action text-white hover:bg-[#1F2937]"
      }`}
    >
      {optimisticFollowing ? "✓ Following" : "Follow"}
    </button>
  );
}
