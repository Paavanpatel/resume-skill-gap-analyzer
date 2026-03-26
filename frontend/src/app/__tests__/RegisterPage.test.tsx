import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterPage from "@/app/(auth)/register/page";

const mockPush = jest.fn();
const mockRegister = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/register",
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ register: mockRegister }),
}));

jest.mock("@/lib/api", () => ({
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Mail: (props: any) => <span data-testid="icon-mail" {...props} />,
  Lock: (props: any) => <span data-testid="icon-lock" {...props} />,
  User: (props: any) => <span data-testid="icon-user" {...props} />,
  AlertCircle: (props: any) => <span data-testid="icon-alert" {...props} />,
  ArrowLeft: (props: any) => <span data-testid="icon-arrow-left" {...props} />,
  ArrowRight: (props: any) => <span data-testid="icon-arrow-right" {...props} />,
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
  Loader2: (props: any) => <span data-testid="icon-loader" {...props} />,
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders step 1 with name and email fields", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("step-info")).toBeInTheDocument();
  });

  it("renders link to login page", () => {
    render(<RegisterPage />);
    const link = screen.getByText("Sign in");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders progress steps", () => {
    render(<RegisterPage />);
    expect(screen.getByText("Your Info")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("disables Continue button when email is empty", () => {
    render(<RegisterPage />);
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn).toBeDisabled();
  });

  it("advances to step 2 when email is valid", () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueBtn);

    expect(screen.getByTestId("step-security")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Create a strong password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Re-enter your password")).toBeInTheDocument();
  });

  it("shows password strength meter on step 2", () => {
    render(<RegisterPage />);

    // Go to step 2
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Type a password to trigger the strength meter
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "Test1" },
    });

    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
    expect(screen.getByText("One special character")).toBeInTheDocument();
  });

  it("shows confirm error when passwords dont match", () => {
    render(<RegisterPage />);

    // Go to step 2
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Fill passwords that dont match
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "StrongPass1!" },
    });
    const confirmInput = screen.getByPlaceholderText("Re-enter your password");
    fireEvent.change(confirmInput, {
      target: { value: "DifferentPass1!" },
    });
    fireEvent.blur(confirmInput);

    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
  });

  it("navigates back from step 2 to step 1", () => {
    render(<RegisterPage />);

    // Go to step 2
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByTestId("step-security")).toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("step-info")).toBeInTheDocument();
  });

  it("advances to step 3 and shows account summary", () => {
    render(<RegisterPage />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText("Jane Doe"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3 — summary visible
    expect(screen.getByTestId("step-confirm")).toBeInTheDocument();
    expect(screen.getByText("Account summary")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Strong password set")).toBeInTheDocument();
  });

  it("requires terms acceptance before creating account", () => {
    render(<RegisterPage />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3 — Create account disabled without terms
    const createBtn = screen.getByRole("button", { name: /create account/i });
    expect(createBtn).toBeDisabled();
  });

  it("registers and redirects on success", async () => {
    mockRegister.mockResolvedValue(undefined);

    render(<RegisterPage />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText("Jane Doe"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3 — accept terms and submit
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("test@example.com", "StrongPass1!", "Test User");
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error on register failure", async () => {
    mockRegister.mockRejectedValue(new Error("Email already taken"));

    render(<RegisterPage />);

    // Step 1
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 2
    fireEvent.change(screen.getByPlaceholderText("Create a strong password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Step 3
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);
    fireEvent.submit(screen.getByRole("button", { name: /create account/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Email already taken")).toBeInTheDocument();
    });
  });
});
