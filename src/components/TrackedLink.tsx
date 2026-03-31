"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { postBrowserEvent, type EventType } from "@/lib/events";

type SharedProps = {
  className?: string;
  children: ReactNode;
  clubId?: string | null;
  eventType?: EventType;
  metadata?: Record<string, unknown>;
};

type InternalProps = SharedProps & {
  href: string;
  prefetch?: boolean;
};

type ExternalProps = SharedProps & {
  href: string;
  target?: string;
  rel?: string;
};

function logIfNeeded(
  eventType: EventType | undefined,
  clubId: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
) {
  if (!eventType) {
    return;
  }

  void postBrowserEvent({
    eventType,
    clubId,
    metadata,
  });
}

export function TrackedLink({
  href,
  className,
  children,
  clubId,
  eventType = "click",
  metadata,
  prefetch,
}: InternalProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      onClick={() => logIfNeeded(eventType, clubId, metadata)}
    >
      {children}
    </Link>
  );
}

export function TrackedAnchor({
  href,
  className,
  children,
  clubId,
  eventType = "click",
  metadata,
  target = "_blank",
  rel = "noopener noreferrer",
}: ExternalProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className={className}
      onClick={() => logIfNeeded(eventType, clubId, metadata)}
    >
      {children}
    </a>
  );
}
