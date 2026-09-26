import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/** One icon + text row in an event card. */
export function EventFact({
  icon,
  label,
  title,
  children,
}: {
  icon: IconName;
  /** Small uppercase label above the title (details card only). */
  label?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <Icon name={icon} className="mt-0.5 shrink-0 text-green" />
      <div>
        {label && (
          <p className="text-[13px] font-bold tracking-[0.08em] text-subtle uppercase">{label}</p>
        )}
        <p className="text-base font-bold md:text-[17px]">{title}</p>
        {children}
      </div>
    </div>
  );
}
