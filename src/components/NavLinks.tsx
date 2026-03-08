"use client";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Завантажити" },
  { href: "/my-files", label: "Мої файли" },
];

export function NavLinkList({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            className={
              isActive
                ? `text-base font-semibold text-zinc-900 ${className ?? ""}`
                : `text-base text-zinc-400 hover:text-zinc-600 ${className ?? ""}`
            }
          >
            {label}
          </a>
        );
      })}
    </>
  );
}

export default function NavLinks() {
  return (
    <nav className="flex items-center gap-6">
      <NavLinkList />
    </nav>
  );
}
