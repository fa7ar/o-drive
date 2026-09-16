import { useEffect, useRef, useState } from "react";

import type { ContentEntry } from "@/core/content";
import { contentUrl } from "@/core/content";
import { OdriveLogo } from "@/components/odrive-logo";

export function PublicFooter({ links }: { links: ContentEntry[] }) {
  const legalLinks = links.filter((item) => item.type === "legal");
  const footerLinks = links.filter((item) => item.type !== "legal");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

        <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {footerLinks.map((item) => (
            <a key={item.id} href={contentUrl(item)} className="hover:text-foreground">
              {item.navLabel || item.title}
            </a>
          ))}

          <div ref={rootRef} className="relative">
            <button
              type="button"
              aria-expanded={open}
              aria-controls="legal-menu"
              onClick={() => setOpen((value) => !value)}
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground sm:min-h-0"
            >
              Legal
            </button>
            {open ? (
              <div
                id="legal-menu"
                className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-border bg-card p-1 shadow-lg sm:left-auto sm:right-0"
              >
                {legalLinks.map((item) => (
                  <a
                    key={item.id}
                    href={contentUrl(item)}
                    onClick={() => setOpen(false)}
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
