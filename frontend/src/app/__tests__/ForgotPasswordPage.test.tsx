import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
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

const mockForgotPassword = jest.fn();

jest.mock("@/lib/api", () => ({
  forgotPassword: (...args: any[]) => mockForgotPassword(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mockForgotPassword.mockReset();
  });

  it("renders the page heading", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("renders email input", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("renders submit button disabled with invalid email", () => {
    render(<ForgotPasswordPage />);
    const button = screen.getByRole("button", { name: /Send reset link/i });
    expect(button).toBeDisabled();
  });

  it("enables submit button with valid email", () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    const button = screen.getByRole("button", { name: /Send reset link/i });
    expect(button).not.toBeDisabled();
  });

  it("shows validation error on blur with invalid email", () => {
    render(<ForgotPasswordPage />);
    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "not-an-email" } });
    fireEvent.blur(input);
    expect(
      screen.getByText("Please enter a valid email address")
    ).toBeInTheDocument();
  });

  it("calls forgotPassword on form submit", async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));
    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("shows success state after submission", async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText("Check your inbox")).toBeInTheDocument();
    });
  });

  it("shows success email reference", async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  it("shows error when forgotPassword throws", async () => {
    mockForgotPassword.mockRejectedValue(new Error("Server error"));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("renders back to sign in link", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText("Back to sign in");
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });


  it("shows cooldown timer right after submission", async () => {
    mockForgotPassword.mockResolvedValue(undefined);
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));
    await waitFor(() => {
      expect(screen.getByText(/resend in/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when blurring invalid email", async () => {
    render(<ForgotPasswordPage />);
    const input = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(input, { target: { value: "bad" } });
    fireEvent.blur(input);
    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
    });
  });
});
