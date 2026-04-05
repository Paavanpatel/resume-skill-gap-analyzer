import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "@/app/(dashboard)/settings/page";
import { ToastProvider } from "@/components/ui/Toast";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();
let mockActiveTab = "profile";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  tier: "free" as const,
  is_verified: true,
  created_at: "2023-01-15T00:00:00Z",
  preferences: { email_notifications: true, ai_provider: "auto" },
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: (key: string) => (key === "tab" ? mockActiveTab : null) }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: jest.fn() }),
}));

const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUpdateProfile = jest.fn();
const mockUpdatePassword = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockDeleteAccount = jest.fn();
const mockGetUsageSummary = jest.fn();
const mockCreatePortalSession = jest.fn();

jest.mock("@/lib/api", () => ({
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  updatePassword: (...args: any[]) => mockUpdatePassword(...args),
  updatePreferences: (...args: any[]) => mockUpdatePreferences(...args),
  deleteAccount: (...args: any[]) => mockDeleteAccount(...args),
  getUsageSummary: () => mockGetUsageSummary(),
  createPortalSession: () => mockCreatePortalSession(),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

jest.mock("@/components/ui/PasswordStrengthMeter", () => ({
  __esModule: true,
  default: () => <div data-testid="strength-meter" />,
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("SettingsPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockLogout.mockClear();
    mockUpdateUser.mockClear();
    mockUpdateProfile.mockReset();
    mockUpdatePassword.mockReset();
    mockUpdatePreferences.mockReset();
    mockDeleteAccount.mockReset();
    mockGetUsageSummary.mockReset();
    mockCreatePortalSession.mockReset();
    mockActiveTab = "profile";

    mockUseAuth.mockReturnValue({
      user: mockUser,
      updateUser: mockUpdateUser,
      logout: mockLogout,
    });

    mockGetUsageSummary.mockResolvedValue({
      tier: "free",
      analyses: { used: 3, limit: 5, pct: 60 },
      period: "Apr 2024",
    });
  });

  describe("Page header", () => {
    it("renders Settings heading", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("renders all tab labels", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Profile")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.getByText("Preferences")).toBeInTheDocument();
      expect(screen.getByText("Billing")).toBeInTheDocument();
      expect(screen.getByText("Account")).toBeInTheDocument();
    });
  });

  describe("Profile tab", () => {
    it("renders user name and email", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
      expect(screen.getByDisplayValue("test@example.com")).toBeInTheDocument();
    });

    it("shows Verified badge when user is verified", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Verified")).toBeInTheDocument();
    });

    it("renders tier badge", () => {
      renderWithProviders(<SettingsPage />);
      // tier badge renders "free" text
      expect(screen.getAllByText("free").length).toBeGreaterThan(0);
    });

    it("calls updateProfile on save", async () => {
      mockUpdateProfile.mockResolvedValue({ ...mockUser, full_name: "New Name" });
      renderWithProviders(<SettingsPage />);
      fireEvent.change(screen.getByDisplayValue("Test User"), {
        target: { value: "New Name" },
      });
      fireEvent.click(screen.getByText("Save changes"));
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalledWith({ full_name: "New Name" });
      });
    });

    it("shows toast when no changes to save", async () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Save changes"));
      await waitFor(() => {
        expect(screen.getByText("No changes to save.")).toBeInTheDocument();
      });
    });

    it("renders nothing when user is null", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        updateUser: mockUpdateUser,
        logout: mockLogout,
      });
      const { container } = renderWithProviders(<SettingsPage />);
      // ProfileTab returns null when user is null
      expect(screen.queryByDisplayValue("Test User")).not.toBeInTheDocument();
    });
  });

  describe("Security tab", () => {
    beforeEach(() => {
      mockActiveTab = "security";
    });

    it("renders change password form", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Change password")).toBeInTheDocument();
    });

    it("renders password fields", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByLabelText("Current password")).toBeInTheDocument();
      expect(screen.getByLabelText("New password")).toBeInTheDocument();
      expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    });

    it("shows validation errors when fields are empty on submit", async () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Update password"));
      await waitFor(() => {
        expect(screen.getByText("Required.")).toBeInTheDocument();
      });
    });

    it("shows mismatch error when passwords don't match", async () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.change(screen.getByLabelText("Current password"), {
        target: { value: "current123" },
      });
      fireEvent.change(screen.getByLabelText("New password"), {
        target: { value: "NewPass1234!" },
      });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "Different1!" },
      });
      fireEvent.click(screen.getByText("Update password"));
      await waitFor(() => {
        expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
      });
    });

    it("calls updatePassword with valid input", async () => {
      mockUpdatePassword.mockResolvedValue(undefined);
      renderWithProviders(<SettingsPage />);
      fireEvent.change(screen.getByLabelText("Current password"), {
        target: { value: "current123" },
      });
      fireEvent.change(screen.getByLabelText("New password"), {
        target: { value: "NewPass12345!" },
      });
      fireEvent.change(screen.getByLabelText("Confirm new password"), {
        target: { value: "NewPass12345!" },
      });
      fireEvent.click(screen.getByText("Update password"));
      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith({
          current_password: "current123",
          new_password: "NewPass12345!",
        });
      });
    });
  });

  describe("Billing tab", () => {
    beforeEach(() => {
      mockActiveTab = "billing";
    });

    it("renders current plan section", async () => {
      await act(async () => { renderWithProviders(<SettingsPage />); });
      expect(screen.getByText("Current plan")).toBeInTheDocument();
    });

    it("shows upgrade link for free tier", async () => {
      await act(async () => { renderWithProviders(<SettingsPage />); });
      expect(screen.getByText("Upgrade →")).toBeInTheDocument();
    });

    it("shows usage stats when usage data loads", async () => {
      renderWithProviders(<SettingsPage />);
      await waitFor(() => {
        expect(screen.getByText("3 / 5")).toBeInTheDocument();
      });
    });

    it("shows Manage Subscription for pro tier", async () => {
      mockUseAuth.mockReturnValue({
        user: { ...mockUser, tier: "pro" },
        updateUser: mockUpdateUser,
        logout: mockLogout,
      });
      await act(async () => { renderWithProviders(<SettingsPage />); });
      expect(screen.getByText("Manage Subscription →")).toBeInTheDocument();
    });
  });

  describe("Account tab", () => {
    beforeEach(() => {
      mockActiveTab = "account";
    });

    it("renders account info", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Account ID:")).toBeInTheDocument();
    });

    it("renders danger zone with delete button", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Delete account")).toBeInTheDocument();
    });

    it("opens delete modal when delete button is clicked", () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Delete my account"));
      expect(screen.getByText("Confirm your password")).toBeInTheDocument();
    });

    it("confirm delete button is disabled until DELETE is typed", () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Delete my account"));
      // Find the confirmation delete button in modal (distinct from the open button)
      const deleteButtons = screen.getAllByText("Delete account");
      const confirmBtn = deleteButtons[deleteButtons.length - 1].closest("button");
      expect(confirmBtn).toBeDisabled();
    });

    it("enables delete button when DELETE is typed", () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Delete my account"));
      fireEvent.change(screen.getByPlaceholderText("DELETE"), {
        target: { value: "DELETE" },
      });
      const deleteButtons = screen.getAllByText("Delete account");
      const confirmBtn = deleteButtons[deleteButtons.length - 1].closest("button");
      expect(confirmBtn).not.toBeDisabled();
    });

    it("closes modal when Cancel is clicked", () => {
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Delete my account"));
      expect(screen.getByText("Confirm your password")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Cancel"));
      expect(screen.queryByText("Confirm your password")).not.toBeInTheDocument();
    });
  });

  describe("Preferences tab", () => {
    beforeEach(() => {
      mockActiveTab = "preferences";
    });

    it("renders theme options", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("light")).toBeInTheDocument();
      expect(screen.getByText("dark")).toBeInTheDocument();
      expect(screen.getByText("system")).toBeInTheDocument();
    });

    it("renders email notifications toggle", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Email notifications")).toBeInTheDocument();
    });

    it("renders AI provider options", () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText("Auto (recommended)")).toBeInTheDocument();
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
    });

    it("calls updatePreferences on save", async () => {
      mockUpdatePreferences.mockResolvedValue(mockUser);
      renderWithProviders(<SettingsPage />);
      fireEvent.click(screen.getByText("Save preferences"));
      await waitFor(() => {
        expect(mockUpdatePreferences).toHaveBeenCalledWith({
          email_notifications: true,
          ai_provider: "auto",
        });
      });
    });
  });
});
