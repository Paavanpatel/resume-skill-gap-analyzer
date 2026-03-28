import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AnalysisTrackerProvider } from "@/context/AnalysisTrackerContext";
import FloatingAnalysisTracker from "@/components/ui/FloatingAnalysisTracker";
import { ToastProvider } from "@/components/ui/Toast";
import SkipToContent from "@/components/ui/SkipToContent";
import { LiveAnnouncerProvider } from "@/components/ui/LiveAnnouncer";
import OfflineBanner from "@/components/ui/OfflineBanner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Resume Skill Gap Analyzer",
    template: "%s | RSGA",
  },
  description:
    "AI-powered resume analysis that identifies skill gaps, provides ATS scoring, and generates personalized improvement roadmaps.",
  keywords: [
    "resume analyzer",
    "skill gap",
    "ATS score",
    "job matching",
    "career development",
  ],
  authors: [{ name: "RSGA Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Resume Skill Gap Analyzer",
    title: "Resume Skill Gap Analyzer",
    description:
      "AI-powered resume analysis that identifies skill gaps and generates personalized improvement roadmaps.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resume Skill Gap Analyzer",
    description:
      "AI-powered resume analysis that identifies skill gaps and generates personalized improvement roadmaps.",
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} ${inter.variable} antialiased`}
      >
        <OfflineBanner />
        <SkipToContent />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <LiveAnnouncerProvider>
                <AnalysisTrackerProvider>
                  {children}
                  <FloatingAnalysisTracker />
                </AnalysisTrackerProvider>
              </LiveAnnouncerProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
