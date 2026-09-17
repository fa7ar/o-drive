import { useEffect, useRef, useState } from "react";

import type { ContentEntry } from "@/core/content";
import { contentUrl } from "@/core/content";
import { OdriveLogo } from "@/components/odrive-logo";

export function PublicFooter({ links }: { links: ContentEntry[] }) {
  const legalLinks = links.filter((item) => item.type === "legal");
  const footerLinks = links.filter((item) => item.type !== "legal");
  const [openMenu, setOpenMenu] = useState<"content" | "legal" | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const contentLinks = [
    { href: "/c/blog", label: "Blog" },
    { href: "/c/changelogs", label: "Changelogs" },
    { href: "/c/docs", label: "Docs" },
  ];

  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <OdriveLogo />
          <span className="text-sm text-muted-foreground">
            by
            <a
              href="https://clab.my.id"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-primary hover:underline"
            >
              Codelab
            </a>
          </span>
        </div>

        <nav ref={rootRef} className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {footerLinks.map((item) => (
            <a key={item.id} href={contentUrl(item)} className="hover:text-foreground">
              {item.navLabel || item.title}
            </a>
          ))}

          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === "content"}
              aria-controls="content-menu"
              onClick={() => setOpenMenu((value) => (value === "content" ? null : "content"))}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
            >
              Content
            </button>
            {openMenu === "content" ? (
              <div
                id="content-menu"
                className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border border-border bg-card p-1 shadow-lg sm:left-auto sm:right-0"
              >
                {contentLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={openMenu === "legal"}
              aria-controls="legal-menu"
              onClick={() => setOpenMenu((value) => (value === "legal" ? null : "legal"))}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
            >
              Legal
            </button>
            {openMenu === "legal" ? (
              <div
                id="legal-menu"
                className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-border bg-card p-1 shadow-lg sm:left-auto sm:right-0"
              >
                {legalLinks.map((item) => (
                  <a
                    key={item.id}
                    href={contentUrl(item)}
                    onClick={() => setOpenMenu(null)}
                    className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {item.navLabel || item.title}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </footer>
  );
}
