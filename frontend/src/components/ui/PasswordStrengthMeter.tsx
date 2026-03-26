"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

function getRequirements(password: string): PasswordRequirement[] {
  return [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

function getStrength(requirements: PasswordRequirement[]): {
  score: number;
  label: string;
  color: string;
  barColor: string;
} {
  const metCount = requirements.filter((r) => r.met).length;

  if (metCount === 0) return { score: 0, label: "", color: "", barColor: "" };
  if (metCount === 1)
    return {
      score: 1,
      label: "Weak",
      color: "text-danger-500",
      barColor: "bg-danger-500",
    };
  if (metCount === 2)
    return {
      score: 2,
      label: "Fair",
      color: "text-warning-500",
      barColor: "bg-warning-500",
    };
  if (metCount === 3)
    return {
      score: 3,
      label: "Good",
      color: "text-primary-500",
      barColor: "bg-primary-500",
    };
  return {
    score: 4,
    label: "Strong",
    color: "text-success-500",
    barColor: "bg-success-500",
  };
}

export default function PasswordStrengthMeter({
  password,
  className,
}: PasswordStrengthMeterProps) {
  const requirements = useMemo(() => getRequirements(password), [password]);
  const strength = useMemo(() => getStrength(requirements), [requirements]);

  if (!password) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((segment) => (
            <div
              key={segment}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-300",
                segment <= strength.score
                  ? strength.barColor
                  : "bg-gray-200 dark:bg-surface-700"
              )}
            />
          ))}
        </div>
        {strength.label && (
          <p className={cn("text-xs font-medium", strength.color)}>
            {strength.label}
          </p>
        )}
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li
            key={req.label}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-200",
              req.met
                ? "text-success-600 dark:text-success-400"
                : "text-gray-400 dark:text-gray-500"
            )}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { getRequirements, getStrength };
