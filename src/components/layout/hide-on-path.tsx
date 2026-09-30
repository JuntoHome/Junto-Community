"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Renders children everywhere except on the given path (case-insensitive). */
export function HideOnPath({ path, children }: { path: string; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.toLowerCase() === path.toLowerCase()) return null;
  return children;
}
