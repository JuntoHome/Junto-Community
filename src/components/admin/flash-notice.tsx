"use client";

import { type ReactNode, useEffect } from "react";

/**
 * A success message shown once after a redirect that adds a flag to the address
 * (e.g. ?created=1). The flag is removed straight away, so reloading the page doesn't
 * show the message again.
 */
export function FlashNotice({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <p
      role="status"
      className="rounded-xl border border-sage-border bg-sage px-5 py-4 text-base font-medium text-green"
    >
      {children}
    </p>
  );
}
