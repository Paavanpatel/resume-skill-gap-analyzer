import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import VerificationBanner from "@/components/ui/VerificationBanner";

jest.mock("lucide-react", () => ({
  MailWarning: (props: any) => <span data-testid="icon-mail-warning" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
  RefreshCw: (props: any) => <span data-testid="icon-refresh" {...props} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockResendVerification = jest.fn();

jest.mock("@/lib/api", () => ({
  resendVerification: (...args: any[]) => mockResendVerification(...args),
}));

const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("VerificationBanner", () => {
  beforeEach(() => {
    mockResendVerification.mockReset();
    mockUseAuth.mockReturnValue({ user: null });
  });

  it("renders nothing when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { container } = render(<VerificationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when user is verified", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com", is_verified: true },
    });
    const { container } = render(<VerificationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner for unverified user", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com", is_verified: false },
    });
    render(<VerificationBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText("Please verify your email address.")
    ).toBeInTheDocument();
  });

  it("shows Enter code link", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com", is_verified: false },
    });
    render(<VerificationBanner />);
    expect(screen.getByText("Enter code")).toBeInTheDocument();
  });

  it("shows Resend email button", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com", is_verified: false },
    });
    render(<VerificationBanner />);
    expect(screen.getByText("Resend email")).toBeInTheDocument();
  });

  it("dismisses banner when X clicked", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "a@b.com", is_verified: false },
    });
    render(<VerificationBanner />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls resendVerification when Resend email is clicked", async () => {
    mockResendVerification.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { email: "test@example.com", is_verified: false },
    });
    render(<VerificationBanner />);
    fireEvent.click(screen.getByText("Resend email"));
    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows 'Code sent!' after successful resend", async () => {
    mockResendVerification.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { email: "test@example.com", is_verified: false },
    });
    render(<VerificationBanner />);
    fireEvent.click(screen.getByText("Resend email"));
    await waitFor(() => {
      expect(screen.getByText("Code sent! Check your inbox.")).toBeInTheDocument();
    });
  });

  it("shows cooldown after successful resend", async () => {
    jest.useFakeTimers();
    mockResendVerification.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { email: "test@example.com", is_verified: false },
    });
    render(<VerificationBanner />);
    fireEvent.click(screen.getByText("Resend email"));
    await waitFor(() => {
      expect(screen.getByText("Code sent! Check your inbox.")).toBeInTheDocument();
    });
    jest.useRealTimers();
  });
});
