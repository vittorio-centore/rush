"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = {
  href: string;
  label: string;
};

type Props = {
  links: NavLink[];
  containerClassName: string;
  baseItemClassName: string;
  activeItemClassName: string;
  inactiveItemClassName: string;
};

function getActiveHref(pathname: string, links: NavLink[]) {
  const exactMatch = links.find((link) => pathname === link.href);
  if (exactMatch) {
    return exactMatch.href;
  }

  const prefixMatches = links
    .filter((link) => pathname.startsWith(`${link.href}/`))
    .sort((left, right) => right.href.length - left.href.length);

  return prefixMatches[0]?.href ?? null;
}

export default function ActiveNav({
  links,
  containerClassName,
  baseItemClassName,
  activeItemClassName,
  inactiveItemClassName,
}: Props) {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname, links);

  return (
    <nav className={containerClassName}>
      {links.map((link) => {
        const active = activeHref === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`${baseItemClassName} ${active ? activeItemClassName : inactiveItemClassName}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
