import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

interface Step {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export default function ProgressSteps({ steps, currentStep, className }: ProgressStepsProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;
        const isPending = i > currentStep;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-initial">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-300",
                  isCompleted && "border-success-500 bg-success-500 text-white",
                  isActive &&
                    "border-primary-500 bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 shadow-glow scale-110",
                  isPending &&
                    "border-gray-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-400 dark:text-gray-500"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : step.icon ? (
                  step.icon
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium whitespace-nowrap",
                  isCompleted && "text-success-600 dark:text-success-400",
                  isActive && "text-primary-600 dark:text-primary-400",
                  isPending && "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-2 mt-[-18px]">
                <div className="h-0.5 w-full rounded-full bg-gray-200 dark:bg-surface-700 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-spring",
                      isCompleted ? "w-full bg-success-500" : "w-0 bg-primary-500"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
