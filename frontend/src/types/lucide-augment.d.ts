/**
 * Augment lucide-react exports to include icons that exist at runtime
 * but are missing from the TypeScript declarations due to moduleResolution: "bundler".
 */
import type { LucideIcon } from "lucide-react";

declare module "lucide-react" {
  export const Check: LucideIcon;
  export const Copy: LucideIcon;
  export const Info: LucideIcon;
  export const Menu: LucideIcon;
  export const Monitor: LucideIcon;
  export const Moon: LucideIcon;
  export const Settings: LucideIcon;
  export const Sun: LucideIcon;
  export const User: LucideIcon;
  export const X: LucideIcon;
  export const Shield: LucideIcon;
  export const SlidersHorizontal: LucideIcon;
  export const Trash2: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Target: LucideIcon;
  export const BookOpen: LucideIcon;
  export const MessageSquare: LucideIcon;

  // Phase 3 — Billing & Tier Enforcement
  export const Lock: LucideIcon;
  export const Zap: LucideIcon;
  export const Sparkles: LucideIcon;
  export const CreditCard: LucideIcon;
  export const Building2: LucideIcon;
}
