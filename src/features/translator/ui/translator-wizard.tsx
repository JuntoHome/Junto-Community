"use client";

import { useState } from "react";
import { StepIndicator } from "./step-indicator";
import { isStepAvailable, STEPS, type StepId } from "./steps";

/**
 * The Translator's steps and the panel for the current one. Everything happens in the
 * browser: the workbook and its rows are kept in this component's state only.
 */
export function TranslatorWizard() {
  const [current, setCurrent] = useState<StepId>("upload");
  // Nothing can be done yet: later tickets mark each step done as its work is built.
  const [done] = useState<ReadonlySet<StepId>>(() => new Set());

  const step = STEPS.find((s) => s.id === current) ?? STEPS[0];

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator
        current={current}
        done={done}
        onSelect={(id) => {
          if (isStepAvailable(id, done)) setCurrent(id);
        }}
      />
      <section
        aria-labelledby="translator-step-title"
        className="rounded-[18px] border border-sand bg-white p-6 md:p-8"
      >
        <h2 id="translator-step-title" className="font-serif text-2xl font-bold text-navy">
          {step.label}
        </h2>
        <p className="mt-3 text-base text-muted">This step isn’t built yet.</p>
      </section>
    </div>
  );
}
