import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** The JCA mark in a white tile, with "JCA Admin". Links to the admin home. */
export function AdminBrand({ onDark = false, onNavigate }: { onDark?: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className={cn(
        "flex w-fit items-center gap-3 no-underline",
        onDark ? "text-white hover:text-white" : "text-navy hover:text-navy",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl bg-white",
          !onDark && "border border-sand",
        )}
      >
        <Image src="/jca-logo-stacked.png" alt="" width={32} height={32} className="size-8" />
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-lg font-bold">JCA Admin</span>
        <span className={cn("block text-xs", onDark ? "text-fog" : "text-subtle")}>Junto Community Alliance</span>
      </span>
    </Link>
  );
}
