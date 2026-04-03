import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";

const mockPush = jest.fn();
let mockToken = "valid-token-123";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (key: string) => (key === "token" ? mockToken : null) }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: jest.fn(),
}));

const mockResetPassword = jest.fn();

jest.mock("@/lib/api", () => ({
  resetPassword: (...args: any[]) => mockResetPassword(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("@/components/ui/PasswordStrengthMeter", () => ({
  __esModule: true,
  default: () => <div data-testid="strength-meter" />,
  getRequirements: (password: string) => [
    { label: "8+ chars", met: password.length >= 8 },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
    { label: "Special", met: /[^a-zA-Z0-9]/.test(password) },
  ],
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

const STRONG_PASSWORD = "StrongPass1!";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockResetPassword.mockReset();
    mockToken = "valid-token-123";
  });

  it("shows invalid link message when token is missing", () => {
    mockToken = "";
    render(<ResetPasswordPage />);
    expect(screen.getByText("Invalid reset link")).toBeInTheDocument();
  });

  it("shows link to forgot-password when token is missing", () => {
    mockToken = "";
    render(<ResetPasswordPage />);
    const link = screen.getByText("Request new link");
    expect(link.closest("a")).toHaveAttribute("href", "/forgot-password");
  });

  it("renders the form when token is present", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText("Set new password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("submit button is disabled when fields are empty", () => {
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("button", { name: /Reset password/i })
    ).toBeDisabled();
  });

  it("shows mismatch error when passwords don't match", () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    const confirmInput = screen.getByLabelText("Confirm password");
    fireEvent.change(confirmInput, { target: { value: "Different1!" } });
    fireEvent.blur(confirmInput);
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("does not show mismatch when passwords match", () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    const confirmInput = screen.getByLabelText("Confirm password");
    fireEvent.change(confirmInput, { target: { value: STRONG_PASSWORD } });
    fireEvent.blur(confirmInput);
    expect(screen.queryByText("Passwords do not match")).not.toBeInTheDocument();
  });

  it("calls resetPassword on valid submit", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reset password/i }));
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith(
        "valid-token-123",
        STRONG_PASSWORD
      );
    });
  });

  it("shows success screen after reset", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reset password/i }));
    await waitFor(() => {
      expect(screen.getByText("Password updated!")).toBeInTheDocument();
    });
  });

  it("navigates to login from success screen", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reset password/i }));
    await waitFor(() => {
      expect(screen.getByText("Password updated!")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Sign in/i }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("shows error when resetPassword throws", async () => {
    mockResetPassword.mockRejectedValue(new Error("Token expired"));
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: STRONG_PASSWORD },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reset password/i }));
    await waitFor(() => {
      expect(screen.getByText("Token expired")).toBeInTheDocument();
    });
  });

  it("toggles password visibility for new password", () => {
    render(<ResetPasswordPage />);
    const pwInput = screen.getByLabelText("New password");
    expect(pwInput).toHaveAttribute("type", "password");
    // Both password fields have Show password buttons; click the first one
    const showButtons = screen.getAllByLabelText("Show password");
    fireEvent.click(showButtons[0]);
    expect(pwInput).toHaveAttribute("type", "text");
    fireEvent.click(screen.getAllByLabelText("Hide password")[0]);
    expect(pwInput).toHaveAttribute("type", "password");
  });

  it("renders strength meter", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByTestId("strength-meter")).toBeInTheDocument();
  });

  it("renders back to sign in link", () => {
    render(<ResetPasswordPage />);
    const link = screen.getByText("Back to sign in");
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });
});
