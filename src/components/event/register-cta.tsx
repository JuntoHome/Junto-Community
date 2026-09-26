import { ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import type { Event } from "@/lib/content/types";
import { cn } from "@/lib/cn";

/** Register button that opens the event's external registration page, with the provider note below it. */
export function RegisterCta({
  event,
  label,
  variant = "gold",
  size = "lg",
  showNote = true,
  className,
}: {
  event: Event;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  showNote?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ButtonLink href={event.registration.url} variant={variant} size={size}>
        {label}
      </ButtonLink>
      {showNote && (
        <p className="text-center text-sm text-subtle">
          You&apos;ll finish registering on {event.registration.provider}.
        </p>
      )}
    </div>
  );
}
