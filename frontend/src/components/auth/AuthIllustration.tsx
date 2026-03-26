"use client";

import { cn } from "@/lib/utils";
import { FileText, Target, TrendingUp, Sparkles } from "lucide-react";

interface AuthIllustrationProps {
  className?: string;
}

export default function AuthIllustration({ className }: AuthIllustrationProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700",
        "text-white p-12",
        className
      )}
    >
      {/* Background decorative circles */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
      <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
      <div className="absolute top-1/3 right-10 h-40 w-40 rounded-full bg-white/5" />

      {/* Content */}
      <div className="relative z-10 max-w-sm text-center space-y-8">
        {/* Logo / Brand */}
        <div className="space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <Target className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SkillGap</h1>
          <p className="text-primary-100 text-sm leading-relaxed">
            AI-powered resume analysis to help you land your dream role
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-4 text-left">
          {[
            {
              icon: FileText,
              title: "Smart Resume Parsing",
              desc: "Upload PDF, DOCX, or TXT files",
            },
            {
              icon: Sparkles,
              title: "AI Skill Matching",
              desc: "Compare against any job description",
            },
            {
              icon: TrendingUp,
              title: "Actionable Roadmap",
              desc: "Personalized learning paths to close gaps",
            },
          ].map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <feature.icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{feature.title}</p>
                <p className="text-xs text-primary-200">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div className="pt-4 border-t border-white/10">
          <p className="text-xs text-primary-200">
            Trusted by job seekers, career changers, and bootcamp graduates
          </p>
        </div>
      </div>
    </div>
  );
}
