import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

const mockPush = jest.fn();
const mockLogin = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/login",
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock("@/lib/api", () => ({
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

// Mock lucide-react icons to simple spans
jest.mock("lucide-react", () => ({
  Mail: (props: any) => <span data-testid="icon-mail" {...props} />,
  Lock: (props: any) => <span data-testid="icon-lock" {...props} />,
  AlertCircle: (props: any) => <span data-testid="icon-alert" {...props} />,
  Loader2: (props: any) => <span data-testid="icon-loader" {...props} />,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders login form with heading and inputs", () => {
    render(<LoginPage />);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  it("renders link to register page", () => {
    render(<LoginPage />);
    const link = screen.getByText("Create one");
    expect(link).toHaveAttribute("href", "/register");
  });

  it("renders social login buttons", () => {
    render(<LoginPage />);
    expect(screen.getByText("Google")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("renders remember me checkbox", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Remember me")).toBeInTheDocument();
  });

  it("renders forgot password link", () => {
    render(<LoginPage />);
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText("Enter your password");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByLabelText("Show password");
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    const hideBtn = screen.getByLabelText("Hide password");
    fireEvent.click(hideBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("shows inline email validation error on blur", () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(emailInput, { target: { value: "invalid" } });
    fireEvent.blur(emailInput);
    expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
  });

  it("calls login and redirects on success", async () => {
    mockLogin.mockResolvedValue(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "password123" },
    });

    const form = screen.getByText("Sign in").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error on login failure", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "bad@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "wrong" },
    });

    const form = screen.getByText("Sign in").closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});
