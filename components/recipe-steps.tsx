"use client";

import { useId, useState } from "react";

export function RecipeSteps({
  steps,
  title,
}: {
  steps: string[];
  title: string;
}) {
  const id = useId();
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());

  function toggleStep(index: number) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="mt-2 grid gap-3">
        {steps.map((step, index) => {
          const inputId = `${id}-${index}`;
          const isCompleted = completed.has(index);

          return (
            <li className="flex items-start gap-3" key={`${step}-${index}`}>
              <input
                checked={isCompleted}
                className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                id={inputId}
                onChange={() => toggleStep(index)}
                type="checkbox"
              />
              <label
                className={
                  isCompleted
                    ? "cursor-pointer text-muted-foreground line-through"
                    : "cursor-pointer"
                }
                htmlFor={inputId}
              >
                {step}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
