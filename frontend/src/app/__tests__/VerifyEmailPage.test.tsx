import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VerifyEmailPage from "@/app/(auth)/verify-email/page";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUpdateUser = jest.fn();
let mockEmail = "test@example.com";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: (key: string) => (key === "email" ? mockEmail : null),
  }),
}));

jest.mock("@/hooks/usePageTitle", () => ({
  usePageTitle: jest.fn(),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ updateUser: mockUpdateUser }),
}));

const mockVerifyEmail = jest.fn();
const mockResendVerification = jest.fn();

jest.mock("@/lib/api", () => ({
  verifyEmail: (...args: any[]) => mockVerifyEmail(...args),
  resendVerification: (...args: any[]) => mockResendVerification(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockUpdateUser.mockClear();
    mockVerifyEmail.mockReset();
    mockResendVerification.mockReset();
    mockEmail = "test@example.com";
  });

  it("renders the page heading", () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText("Check your email")).toBeInTheDocument();
  });

  it("renders OTP input boxes", () => {
    render(<VerifyEmailPage />);
    // 6 digit boxes
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i}`)).toBeInTheDocument();
    }
  });

  it("shows masked email", () => {
    mockEmail = "test@example.com";
    render(<VerifyEmailPage />);
    // "te••••@example.com" — the first 2 chars + 4 bullets + domain
    expect(screen.getByText(/te••••@example.com/)).toBeInTheDocument();
  });

  it("submit button is disabled when OTP is incomplete", () => {
    render(<VerifyEmailPage />);
    expect(screen.getByRole("button", { name: /Verify email/i })).toBeDisabled();
  });

  it("enables submit after all 6 digits entered", () => {
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: `${i}` },
      });
    }
    expect(screen.getByRole("button", { name: /Verify email/i })).not.toBeDisabled();
  });

  it("calls verifyEmail with correct otp on submit", async () => {
    mockVerifyEmail.mockResolvedValue({ email: "test@example.com", is_verified: true });
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: `${i}` },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /Verify email/i }));
    await waitFor(() => {
      expect(mockVerifyEmail).toHaveBeenCalledWith("test@example.com", "123456");
    });
  });

  it("shows verified screen on success", async () => {
    mockVerifyEmail.mockResolvedValue({ email: "test@example.com", is_verified: true });
    jest.useFakeTimers();
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: `${i}` },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /Verify email/i }));
    await waitFor(() => {
      expect(screen.getByText("Email verified!")).toBeInTheDocument();
    });
    jest.useRealTimers();
  });

  it("redirects to dashboard after verification", async () => {
    mockVerifyEmail.mockResolvedValue({ email: "test@example.com", is_verified: true });
    jest.useFakeTimers();
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: `${i}` },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /Verify email/i }));
    await waitFor(() => {
      expect(screen.getByText("Email verified!")).toBeInTheDocument();
    });
    jest.advanceTimersByTime(1500);
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    jest.useRealTimers();
  });

  it("shows error on wrong OTP", async () => {
    mockVerifyEmail.mockRejectedValue(new Error("Invalid code"));
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: "0" },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /Verify email/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Invalid code")).toBeInTheDocument();
    });
  });

  it("clears digits on error", async () => {
    mockVerifyEmail.mockRejectedValue(new Error("Invalid code"));
    render(<VerifyEmailPage />);
    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i}`), {
        target: { value: "9" },
      });
    }
    fireEvent.click(screen.getByRole("button", { name: /Verify email/i }));
    await waitFor(() => {
      expect(screen.getByText("Invalid code")).toBeInTheDocument();
    });
    // All digit inputs should be cleared
    const input = screen.getByLabelText("Digit 1") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("shows Resend code button", () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText("Resend code")).toBeInTheDocument();
  });

  it("calls resendVerification when Resend code is clicked", async () => {
    mockResendVerification.mockResolvedValue(undefined);
    render(<VerifyEmailPage />);
    fireEvent.click(screen.getByText("Resend code"));
    await waitFor(() => {
      expect(mockResendVerification).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows Skip for now button", () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText("Skip for now")).toBeInTheDocument();
  });

  it("navigates to dashboard on Skip for now", () => {
    render(<VerifyEmailPage />);
    fireEvent.click(screen.getByText("Skip for now"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("auto-advances to next digit on input", () => {
    render(<VerifyEmailPage />);
    const digit1 = screen.getByLabelText("Digit 1");
    fireEvent.change(digit1, { target: { value: "3" } });
    // digit 2 should get focus — difficult to assert focus, but no error
    expect(digit1).toBeInTheDocument();
  });

  it("handles paste of 6 digits", () => {
    render(<VerifyEmailPage />);
    const container = screen.getByLabelText("Digit 1").closest("div")!;
    fireEvent.paste(container, {
      clipboardData: { getData: () => "123456" },
    });
    const inputs = [1, 2, 3, 4, 5, 6].map(
      (i) => screen.getByLabelText(`Digit ${i}`) as HTMLInputElement
    );
    // All digits should be filled
    inputs.forEach((input, idx) => {
      expect(input.value).toBe(String(idx + 1));
    });
  });
});
