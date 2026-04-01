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

function isActivePath(pathname: string, href: string) {
  // Exact-match only routes: root and any path that has no sub-routes in the nav
  if (href === "/" || href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ActiveNav({
  links,
  containerClassName,
  baseItemClassName,
  activeItemClassName,
  inactiveItemClassName,
}: Props) {
  const pathname = usePathname();

  return (
    <nav className={containerClassName}>
      {links.map((link) => {
        const active = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${baseItemClassName} ${active ? activeItemClassName : inactiveItemClassName}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
