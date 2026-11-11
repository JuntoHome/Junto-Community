import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { isStepAvailable, STEPS, type StepId } from "./steps";

/**
 * The numbered row of steps. The current step is highlighted; done steps show a tick and
 * can be reopened; steps whose earlier steps aren't done yet are disabled.
 */
export function StepIndicator({
  current,
  done,
  onSelect,
}: {
  current: StepId;
  done: ReadonlySet<StepId>;
  onSelect: (id: StepId) => void;
}) {
  return (
    <nav aria-label="Translator steps">
      <ol className="flex flex-wrap gap-2 sm:flex-nowrap">
        {STEPS.map((step, i) => {
          const isCurrent = step.id === current;
          const isDone = done.has(step.id);
          const available = isStepAvailable(step.id, done);
          return (
            <li key={step.id} className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:basis-0">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                disabled={!available}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors",
                  isCurrent
                    ? "border-navy bg-navy font-semibold text-white"
                    : available
                      ? "cursor-pointer border-sand bg-white text-navy hover:bg-ivory"
                      : "cursor-not-allowed border-sand bg-white text-subtle opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    isCurrent ? "bg-gold text-navy-deep" : isDone ? "bg-sage text-green" : "bg-mist text-navy",
                  )}
                >
                  {isDone && !isCurrent ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <span className="truncate">
                  {step.label}
                  {isDone && <span className="sr-only"> (done)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
