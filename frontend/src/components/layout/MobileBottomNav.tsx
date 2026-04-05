"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Analyze", icon: BarChart3 },
  { href: "/history", label: "History", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40",
        "flex items-center justify-around",
        "h-16 border-t",
        "bg-white/90 dark:bg-surface-800/90 backdrop-blur-lg",
        "border-gray-200 dark:border-surface-700",
        "safe-area-bottom",
        "sm:hidden"
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 min-w-[64px] min-h-[44px] rounded-lg transition-colors",
              isActive
                ? "text-primary-600 dark:text-primary-400"
                : "text-gray-500 dark:text-gray-400 active:text-gray-700 dark:active:text-gray-300"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "animate-bounce-subtle")} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary-600 dark:bg-primary-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
