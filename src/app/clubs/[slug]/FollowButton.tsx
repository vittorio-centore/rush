"use client";

import { useTransition } from "react";
import { followClub, unfollowClub } from "./actions";

type Props = {
  clubId: string;
  isFollowing: boolean;
};

export default function FollowButton({ clubId, isFollowing }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(() => {
      if (isFollowing) {
        unfollowClub(clubId);
      } else {
        followClub(clubId);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        isFollowing
          ? "border border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          : "bg-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {isPending ? "…" : isFollowing ? "✓ Following" : "Follow"}
    </button>
  );
}
