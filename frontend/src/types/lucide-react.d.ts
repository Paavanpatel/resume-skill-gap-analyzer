declare module "lucide-react" {
  import { FC, SVGProps } from "react";

  interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
    className?: string;
  }

  type LucideIcon = FC<LucideProps>;

  export const Loader2: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Clock: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const XCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const Upload: LucideIcon;
  export const FileText: LucideIcon;
  export const Briefcase: LucideIcon;
  export const LogOut: LucideIcon;
  export const BarChart3: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Lightbulb: LucideIcon;
  export const History: LucideIcon;
  export const FileSearch: LucideIcon;
  export const WifiOff: LucideIcon;
}
