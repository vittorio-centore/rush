"use client";

import { useId, useState } from "react";

type Props = {
  id: string;
  name: string;
  label: string;
  accept: string;
  hint: string;
  currentHref: string | null;
  currentLabel: string;
  emptyLabel: string;
};

export default function ProfileUploadField({
  id,
  name,
  label,
  accept,
  hint,
  currentHref,
  currentLabel,
  emptyLabel,
}: Props) {
  const fallbackId = useId();
  const inputId = id || fallbackId;
  const [fileName, setFileName] = useState<string>("");

  return (
    <div>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="rounded-[1.1rem] border border-border-warm bg-white p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <label
              htmlFor={inputId}
              className="inline-flex cursor-pointer items-center justify-center rounded-control border border-brand-oxblood/14 bg-brand-oxblood-soft px-3 py-2 text-sm font-medium text-brand-oxblood transition-[var(--transition-interact)] hover:border-brand-oxblood/22 hover:bg-[#f1e5e6]"
            >
              Choose file
            </label>
            <input
              id={inputId}
              name={name}
              type="file"
              accept={accept}
              className="sr-only"
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? "");
              }}
            />
          </div>
          <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
            {fileName || "No file chosen"}
          </p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-warm pt-3">
          <p className="text-xs text-ink-muted">{hint}</p>
          {currentHref ? (
            <a
              href={currentHref}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-xs font-medium text-brand-oxblood transition-colors hover:text-ink"
            >
              {currentLabel} ↗
            </a>
          ) : (
            <span className="shrink-0 text-xs text-ink-muted">{emptyLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
