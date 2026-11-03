"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { moveProfile } from "./actions";

type Direction = "up" | "down";

const buttonClass =
  "flex size-11 cursor-pointer items-center justify-center rounded-lg border border-field bg-white text-navy hover:border-navy hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-field disabled:hover:bg-white";

/**
 * Move up and Move down for one profile in the admin list. After a move the list shows
 * the new order; focus stays on the button that was used (or the other one, at the top
 * or bottom), and screen readers hear the new position.
 */
export function MoveButtons({
  id,
  name,
  position,
  total,
  className,
}: {
  id: string;
  name: string;
  /** 1 for the first profile in the list. */
  position: number;
  total: number;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error?: true }>();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const moved = useRef<Direction | null>(null);

  // Runs once the list has re-rendered with the new position.
  useEffect(() => {
    const direction = moved.current;
    if (!direction) return;
    moved.current = null;
    const target = direction === "up" ? (position === 1 ? downRef : upRef) : position === total ? upRef : downRef;
    target.current?.focus();
  }, [position, total]);

  const move = (direction: Direction) => {
    moved.current = direction;
    startTransition(async () => {
      const result = await moveProfile(id, direction);
      if ("error" in result) {
        moved.current = null;
        setMessage({ text: result.error, error: true });
      } else {
        setMessage({ text: `Moved ${name} to position ${result.position} of ${result.total}.` });
      }
    });
  };

  if (total < 2) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex gap-2">
        {(["up", "down"] as const).map((direction) => (
          <button
            key={direction}
            ref={direction === "up" ? upRef : downRef}
            type="button"
            onClick={() => move(direction)}
            disabled={pending || (direction === "up" ? position === 1 : position === total)}
            aria-label={`Move ${name} ${direction}`}
            className={buttonClass}
          >
            <Icon name={direction === "up" ? "arrowUp" : "arrowDown"} size={20} />
          </button>
        ))}
      </div>
      <p role="status" className={message?.error ? "max-w-60 text-sm font-medium text-red-700" : "sr-only"}>
        {message?.text}
      </p>
    </div>
  );
}
