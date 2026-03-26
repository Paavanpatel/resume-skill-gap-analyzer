import React from "react";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Mock the API module
jest.mock("@/lib/api", () => ({
  getStoredTokens: jest.fn(),
  storeTokens: jest.fn(),
  clearTokens: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
}));

function TestConsumer() {
  const { isAuthenticated, isLoading, user } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? "loading" : "done"}</span>
      <span data-testid="authenticated">{isAuthenticated ? "yes" : "no"}</span>
      <span data-testid="user">{user?.email ?? "none"}</span>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state initially", () => {
    const { getStoredTokens } = require("@/lib/api");
    getStoredTokens.mockReturnValue(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    // After useEffect runs with no tokens, loading should be false
    expect(screen.getByTestId("authenticated").textContent).toBe("no");
  });

  it("sets authenticated when tokens exist and getMe succeeds", async () => {
    const { getStoredTokens, getMe } = require("@/lib/api");
    getStoredTokens.mockReturnValue({ access: "token" });
    getMe.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      full_name: "Test",
      is_active: true,
      is_verified: false,
      tier: "free",
      created_at: "2024-01-01",
    });

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("yes");
    expect(screen.getByTestId("user").textContent).toBe("test@example.com");
  });

  it("clears auth when getMe fails", async () => {
    const { getStoredTokens, getMe, clearTokens } = require("@/lib/api");
    getStoredTokens.mockReturnValue({ access: "token" });
    getMe.mockRejectedValue(new Error("401"));

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("no");
    expect(clearTokens).toHaveBeenCalled();
  });

  it("throws when useAuth is used outside provider", () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useAuth must be used within an AuthProvider");
    spy.mockRestore();
  });
});
