import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * An organization's logo, scaled to fit its box without cropping. Logos come in every shape.
 * `eager` when it is at the top of the page, so it doesn't wait to be scrolled to.
 */
export function ProfileLogo({
  src,
  name,
  className,
  eager = false,
}: {
  src: string;
  name: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src={src}
        alt={`${name} logo`}
        fill
        sizes="240px"
        loading={eager ? "eager" : "lazy"}
        className="object-contain object-left"
      />
    </div>
  );
}
