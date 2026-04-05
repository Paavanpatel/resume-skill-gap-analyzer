import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";

// ── Shared mocks ─────────────────────────────────────────────

jest.mock("@/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
      tier: "pro",
      full_name: "Admin",
    },
  }),
}));

const mockAdminGetAnalytics = jest.fn();
const mockAdminGetStorageStats = jest.fn();
const mockAdminGetUsers = jest.fn();
const mockAdminGetAnalyses = jest.fn();
const mockAdminGetMetricsSummary = jest.fn();
const mockAdminGetLogs = jest.fn();

jest.mock("@/lib/api", () => ({
  adminGetAnalytics: () => mockAdminGetAnalytics(),
  adminGetStorageStats: () => mockAdminGetStorageStats(),
  adminGetUsers: (params: any) => mockAdminGetUsers(params),
  adminUpdateUser: jest.fn(),
  adminDeactivateUser: jest.fn(),
  adminGetAnalyses: (params: any) => mockAdminGetAnalyses(params),
  adminRetryAnalysis: jest.fn(),
  adminDeleteAnalysis: jest.fn(),
  adminGetMetricsSummary: () => mockAdminGetMetricsSummary(),
  adminGetLogs: (params: any) => mockAdminGetLogs(params),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("@/hooks/useHealthCheck", () => ({
  useHealthCheck: () => ({
    status: "healthy",
    checks: { database: "ok", redis: "ok", celery: "ok" },
    lastChecked: new Date(),
    isLoading: false,
  }),
}));

jest.mock("next/dynamic", () => (factory: any) => {
  const Component = () => <div data-testid="chart-mock" />;
  Component.displayName = "DynamicMock";
  return Component;
});

// Mock all lucide-react icons to simple spans
jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy(
    {},
    {
      get: () => MockIcon,
    }
  );
});

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

// ── Admin Dashboard ──────────────────────────────────────────

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    mockAdminGetAnalytics.mockResolvedValue({
      total_users: 100,
      active_users: 50,
      verified_users: 80,
      total_analyses: 500,
      completed_analyses: 400,
      failed_analyses: 50,
      avg_match_score: 72.5,
      avg_ats_score: 70.0,
      users_by_tier: { free: 60, pro: 35, enterprise: 5 },
      users_by_role: { user: 95, admin: 5 },
      analyses_by_status: { completed: 400, failed: 50, queued: 30, processing: 20 },
      analyses_per_day: [{ date: "2024-04-01", count: 10 }],
      registrations_per_day: [{ date: "2024-04-01", count: 5 }],
    });
    mockAdminGetStorageStats.mockResolvedValue({
      backend: "local",
      total_files: 500,
      total_bytes: 52428800,
      bucket: null,
    });
  });

  it("renders page heading", async () => {
    const { default: AdminPage } = await import("@/app/(admin)/admin/page");
    renderWithProviders(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });
  });

  it("shows loading skeleton initially", async () => {
    mockAdminGetAnalytics.mockReturnValue(new Promise(() => {}));
    const { default: AdminPage } = await import("@/app/(admin)/admin/page");
    renderWithProviders(<AdminPage />);
    // Content should show loading state
    expect(screen.queryByText("Analytics Overview")).not.toBeInTheDocument();
  });

  it("shows KPI cards after data loads", async () => {
    const { default: AdminPage } = await import("@/app/(admin)/admin/page");
    renderWithProviders(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("100")).toBeInTheDocument(); // total_users
    });
  });

  it("shows error message if analytics fails", async () => {
    mockAdminGetAnalytics.mockRejectedValue(new Error("Fetch failed"));
    const { default: AdminPage } = await import("@/app/(admin)/admin/page");
    renderWithProviders(<AdminPage />);
    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    });
  });
});

// ── Admin Analyses ────────────────────────────────────────────

describe("AdminAnalysesPage", () => {
  beforeEach(() => {
    mockAdminGetAnalyses.mockResolvedValue({
      analyses: [
        {
          id: "a1",
          user_email: "user@example.com",
          status: "completed",
          score: 85,
          created_at: "2024-04-01T12:00:00Z",
          job_title: "Software Engineer",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
  });

  it("renders page heading", async () => {
    const { default: AdminAnalysesPage } = await import("@/app/(admin)/admin/analyses/page");
    renderWithProviders(<AdminAnalysesPage />);
    await waitFor(() => {
      expect(screen.getByText("Analyses")).toBeInTheDocument();
    });
  });

  it("renders analysis data after loading", async () => {
    const { default: AdminAnalysesPage } = await import("@/app/(admin)/admin/analyses/page");
    renderWithProviders(<AdminAnalysesPage />);
    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });
  });

  it("shows empty state when no analyses", async () => {
    mockAdminGetAnalyses.mockResolvedValue({
      analyses: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
    const { default: AdminAnalysesPage } = await import("@/app/(admin)/admin/analyses/page");
    renderWithProviders(<AdminAnalysesPage />);
    await waitFor(() => {
      expect(screen.getByText("No analyses found.")).toBeInTheDocument();
    });
  });

  it("shows error message if fetch fails", async () => {
    mockAdminGetAnalyses.mockRejectedValue(new Error("Server error"));
    const { default: AdminAnalysesPage } = await import("@/app/(admin)/admin/analyses/page");
    renderWithProviders(<AdminAnalysesPage />);
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });
});

// ── Admin Users ───────────────────────────────────────────────

describe("AdminUsersPage", () => {
  beforeEach(() => {
    mockAdminGetUsers.mockResolvedValue({
      users: [
        {
          id: "u1",
          email: "user@example.com",
          full_name: "Test User",
          tier: "free",
          role: "user",
          is_active: true,
          is_verified: true,
          created_at: "2024-01-01T00:00:00Z",
          analyses_count: 5,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
  });

  it("renders page heading", async () => {
    const { default: AdminUsersPage } = await import("@/app/(admin)/admin/users/page");
    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
    });
  });

  it("renders user data", async () => {
    const { default: AdminUsersPage } = await import("@/app/(admin)/admin/users/page");
    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    const { default: AdminUsersPage } = await import("@/app/(admin)/admin/users/page");
    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  it("shows error if fetch fails", async () => {
    mockAdminGetUsers.mockRejectedValue(new Error("Unauthorized"));
    const { default: AdminUsersPage } = await import("@/app/(admin)/admin/users/page");
    renderWithProviders(<AdminUsersPage />);
    await waitFor(() => {
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    });
  });
});

// ── Admin System ──────────────────────────────────────────────

describe("AdminSystemPage", () => {
  beforeEach(() => {
    mockAdminGetMetricsSummary.mockResolvedValue({
      celery: {
        active_tasks: 2,
        scheduled_tasks: 5,
        queue_lengths: { analysis: 3, default: 0 },
        worker_count: 2,
      },
      redis: {
        used_memory_mb: 128,
        total_keys: 500,
        hit_rate: 0.95,
      },
    });
    mockAdminGetLogs.mockResolvedValue({
      records: [
        {
          id: "log-1",
          level: "INFO",
          message: "Task completed",
          timestamp: "2024-04-01T12:00:00Z",
          logger: "app",
        },
      ],
      total: 1,
    });
  });

  it("renders system health heading", async () => {
    const { default: AdminSystemPage } = await import("@/app/(admin)/admin/system/page");
    renderWithProviders(<AdminSystemPage />);
    await waitFor(() => {
      expect(screen.getByText("System Health")).toBeInTheDocument();
    });
  });

  it("renders dependency health section", async () => {
    const { default: AdminSystemPage } = await import("@/app/(admin)/admin/system/page");
    renderWithProviders(<AdminSystemPage />);
    await waitFor(() => {
      expect(screen.getByText("Dependency Health")).toBeInTheDocument();
    });
  });
});
