import React from "react";

// Create a generic mock icon component
const createMockIcon = (name: string) => {
  const Icon = (props: any) => <svg data-testid={`icon-${name}`} {...props} />;
  Icon.displayName = name;
  return Icon;
};

export const Loader2 = createMockIcon("Loader2");
export const ArrowLeft = createMockIcon("ArrowLeft");
export const ArrowRight = createMockIcon("ArrowRight");
export const Clock = createMockIcon("Clock");
export const CheckCircle2 = createMockIcon("CheckCircle2");
export const XCircle = createMockIcon("XCircle");
export const AlertTriangle = createMockIcon("AlertTriangle");
export const Upload = createMockIcon("Upload");
export const FileText = createMockIcon("FileText");
export const Briefcase = createMockIcon("Briefcase");
export const LogOut = createMockIcon("LogOut");
export const BarChart = createMockIcon("BarChart");
export const ChevronDown = createMockIcon("ChevronDown");
export const ChevronUp = createMockIcon("ChevronUp");
export const Lightbulb = createMockIcon("Lightbulb");
export const History = createMockIcon("History");
export const FileSearch = createMockIcon("FileSearch");
export const TrendingUp = createMockIcon("TrendingUp");
export const Trophy = createMockIcon("Trophy");
export const Calendar = createMockIcon("Calendar");
export const BarChart3 = createMockIcon("BarChart3");
export const MoreVertical = createMockIcon("MoreVertical");
export const Eye = createMockIcon("Eye");
export const RefreshCw = createMockIcon("RefreshCw");
export const Trash2 = createMockIcon("Trash2");
export const GitCompareArrows = createMockIcon("GitCompareArrows");
export const X = createMockIcon("X");
export const SlidersHorizontal = createMockIcon("SlidersHorizontal");
export const ArrowUpDown = createMockIcon("ArrowUpDown");
export const Search = createMockIcon("Search");
export const ChevronLeft = createMockIcon("ChevronLeft");
export const ChevronRight = createMockIcon("ChevronRight");