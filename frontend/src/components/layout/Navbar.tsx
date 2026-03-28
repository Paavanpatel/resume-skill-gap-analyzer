"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LogOut,
  FileText,
  BarChart3,
  Menu,
  X,
  User,
  Settings,
  ChevronDown,
  Sparkles,
  CreditCard,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Dropdown from "@/components/ui/Dropdown";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { useHealthCheck } from "@/hooks/useHealthCheck";

const navItems = [
  { href: "/dashboard", label: "New Analysis", icon: BarChart3 },
  { href: "/history", label: "History", icon: FileText },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { status: healthStatus, checks, lastChecked } = useHealthCheck(30_000);

  // Glass effect on scroll
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const handleDropdownSelect = useCallback(
    (id: string) => {
      if (id === "logout") logout();
      if (id === "settings") router.push("/settings");
      if (id === "billing") router.push("/settings?tab=billing");
      if (id === "admin") router.push("/admin");
    },
    [logout, router]
  );

  // User initials for avatar
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "U";

  // Tier badge colours
  const tierBadgeClass =
    user?.tier === "pro"
      ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300"
      : user?.tier === "enterprise"
        ? "bg-warning-100 dark:bg-warning-900/40 text-warning-700 dark:text-warning-300"
        : "bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400";

  const dropdownItems = [
    {
      id: "profile",
      label: user?.email || "Profile",
      icon: <User className="h-4 w-4" />,
      disabled: true,
    },
    { id: "divider-1", label: "", divider: true },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-4 w-4" />,
    },
    {
      id: "billing",
      label: "Billing & Usage",
      icon: <CreditCard className="h-4 w-4" />,
    },
    // Admin link — only visible for admin/super_admin
    ...(isAdmin
      ? [
          { id: "divider-admin", label: "", divider: true },
          {
            id: "admin",
            label: "Admin Dashboard",
            icon: <Shield className="h-4 w-4" />,
          },
        ]
      : []),
    { id: "divider-2", label: "", divider: true },
    {
      id: "logout",
      label: "Log out",
      icon: <LogOut className="h-4 w-4" />,
      danger: true,
    },
  ];

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-200",
          "border-b",
          scrolled
            ? "glass dark:glass-dark border-gray-200/60 dark:border-surface-700/60 shadow-xs"
            : "bg-white dark:bg-surface-800 border-gray-200 dark:border-surface-700"
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-lg font-bold tracking-tighter"
            >
              <span className="text-gradient">SkillGap</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive =
                  pathname === href ||
                  (href !== "/dashboard" && pathname.startsWith(href));

                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute -bottom-[11px] left-3 right-3 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Status + Theme + Avatar */}
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={healthStatus}
              checks={checks}
              lastChecked={lastChecked}
              className="hidden sm:flex"
            />
            <ThemeToggle />

            {/* User dropdown (desktop) */}
            <div className="hidden sm:block">
              <Dropdown
                trigger={
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-surface-700 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-semibold text-white">
                      {initials}
                    </div>
                    {/* Tier badge */}
                    {user?.tier && user.tier !== "free" && (
                      <span
                        className={`hidden md:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierBadgeClass}`}
                      >
                        <Sparkles className="h-3 w-3" />
                        {user.tier}
                      </span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                }
                items={dropdownItems}
                onSelect={handleDropdownSelect}
              />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-700 sm:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 animate-backdrop-in sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-surface-800 shadow-xl dark:shadow-dark-lg animate-drawer-in sm:hidden">
            <div className="flex h-14 items-center justify-between px-4 border-b border-gray-200 dark:border-surface-700">
              <span className="text-lg font-bold tracking-tighter text-gradient">
                SkillGap
              </span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-700"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User info */}
            <div className="px-4 py-4 border-b border-gray-100 dark:border-surface-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-sm font-semibold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  {user?.full_name && (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.full_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user?.email}
                  </p>
                  {user?.tier && (
                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierBadgeClass}`}
                    >
                      {user.tier !== "free" && <Sparkles className="h-3 w-3" />}
                      {user.tier}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Nav links */}
            <nav className="px-3 py-3 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Admin + Theme + Logout */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 dark:border-surface-700 space-y-3">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <Shield className="h-5 w-5" />
                  Admin Dashboard
                </Link>
              )}
              <ThemeToggle variant="full" />
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
