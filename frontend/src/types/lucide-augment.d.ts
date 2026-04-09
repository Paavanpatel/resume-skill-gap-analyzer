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

  // Phase 5 — Email Verification & Password Reset
  export const Mail: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const MailWarning: LucideIcon;

  // Admin panel icons
  export const Inbox: LucideIcon;
  export const Users: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Activity: LucideIcon;
  export const HardDrive: LucideIcon;
  export const Server: LucideIcon;
  export const Database: LucideIcon;
  export const Cpu: LucideIcon;
  export const Layers: LucideIcon;
  export const MinusCircle: LucideIcon;
  export const UserX: LucideIcon;
  export const UserCheck: LucideIcon;

  // Dashboard & History components
  export const GitCompareArrows: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const Minus: LucideIcon;
  export const File: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const Eye: LucideIcon;
  export const Search: LucideIcon;
  export const ArrowUpDown: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const BarChart: LucideIcon;
  export const Trophy: LucideIcon;
  export const Calendar: LucideIcon;
  export const ClipboardPaste: LucideIcon;

  // Preview page
  export const Download: LucideIcon;
  export const Award: LucideIcon;
}
