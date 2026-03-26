import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/ui/Toast";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  __esModule: true,
  CheckCircle2: (props: any) => (
    <span data-testid="icon-check-circle" {...props} />
  ),
  XCircle: (props: any) => <span data-testid="icon-x-circle" {...props} />,
  AlertTriangle: (props: any) => (
    <span data-testid="icon-alert-triangle" {...props} />
  ),
  Info: (props: any) => <span data-testid="icon-info" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

// Test component that uses the toast hook
function TestComponent({
  onToastReady,
}: {
  onToastReady?: (toast: any) => void;
}) {
  const toast = useToast();

  React.useEffect(() => {
    if (onToastReady) {
      onToastReady(toast);
    }
  }, [toast, onToastReady]);

  return (
    <button
      onClick={() => toast.toast("Test message", "success")}
      data-testid="trigger-toast"
    >
      Show Toast
    </button>
  );
}

// Component that uses toast outside provider (for error testing)
function OutsideProviderComponent() {
  useToast();
  return <div>Should not render</div>;
}

describe("Toast", () => {
  describe("useToast hook", () => {
    it("throws error when useToast is used outside provider", () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<OutsideProviderComponent />);
      }).toThrow("useToast must be used within a ToastProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("ToastProvider rendering", () => {
    it("renders nothing initially (no toasts)", () => {
      render(
        <ToastProvider>
          <div data-testid="test-child">Test Content</div>
        </ToastProvider>
      );

      // Provider should render children
      expect(screen.getByTestId("test-child")).toBeInTheDocument();

      // No toast alerts should be visible
      expect(screen.queryAllByRole("alert")).toHaveLength(0);
    });

    it("renders provider children", () => {
      render(
        <ToastProvider>
          <span data-testid="child-content">Child Content</span>
        </ToastProvider>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("Toast message display", () => {
    it("shows toast message when toast() is called", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });
    });

    it("renders toast with correct variant styling (success shows CheckCircle2 icon)", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });
    });

    it("renders toast with error variant and XCircle icon", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("Error occurred", "error");
                }
              }}
              data-testid="error-trigger"
            >
              Show Error
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("error-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("icon-x-circle")).toBeInTheDocument();
        expect(screen.getByText("Error occurred")).toBeInTheDocument();
      });
    });

    it("renders toast with warning variant and AlertTriangle icon", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("Warning message", "warning");
                }
              }}
              data-testid="warning-trigger"
            >
              Show Warning
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("warning-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("icon-alert-triangle")).toBeInTheDocument();
        expect(screen.getByText("Warning message")).toBeInTheDocument();
      });
    });

    it("renders toast with info variant and Info icon", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("Info message", "info");
                }
              }}
              data-testid="info-trigger"
            >
              Show Info
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("info-trigger"));

      await waitFor(() => {
        expect(screen.getByTestId("icon-info")).toBeInTheDocument();
        expect(screen.getByText("Info message")).toBeInTheDocument();
      });
    });
  });

  describe("Toast lifecycle", () => {
    it("auto-dismisses after duration", async () => {
      jest.useFakeTimers();

      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });

      // Fast-forward time by default duration (4000ms)
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      await waitFor(() => {
        expect(screen.queryByText("Test message")).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("does not auto-dismiss when duration is 0", async () => {
      jest.useFakeTimers();

      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("Permanent toast", "info", 0);
                }
              }}
              data-testid="permanent-trigger"
            >
              Show Permanent
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("permanent-trigger"));

      await waitFor(() => {
        expect(screen.getByText("Permanent toast")).toBeInTheDocument();
      });

      // Fast-forward time well beyond default duration
      jest.advanceTimersByTime(10000);

      // Toast should still be visible
      expect(screen.getByText("Permanent toast")).toBeInTheDocument();

      jest.useRealTimers();
    });

    it("dismiss button removes toast", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Test message")).toBeInTheDocument();
      });

      const dismissButtons = screen.getAllByLabelText("Dismiss notification");
      expect(dismissButtons.length).toBeGreaterThan(0);

      fireEvent.click(dismissButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText("Test message")).not.toBeInTheDocument();
      });
    });
  });

  describe("Multiple toasts", () => {
    it("multiple toasts can be shown simultaneously", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("First toast", "success");
                  toastInstance.toast("Second toast", "error");
                  toastInstance.toast("Third toast", "info");
                }
              }}
              data-testid="multi-trigger"
            >
              Show Multiple
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("multi-trigger"));

      await waitFor(() => {
        expect(screen.getByText("First toast")).toBeInTheDocument();
        expect(screen.getByText("Second toast")).toBeInTheDocument();
        expect(screen.getByText("Third toast")).toBeInTheDocument();
      });

      // Should have 3 alerts
      const alerts = screen.getAllByRole("alert");
      expect(alerts).toHaveLength(3);
    });

    it("individual dismiss removes only that toast", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <div>
            <button
              onClick={() => {
                if (toastInstance) {
                  toastInstance.toast("Toast 1", "success");
                  toastInstance.toast("Toast 2", "error");
                }
              }}
              data-testid="two-trigger"
            >
              Show Two
            </button>
            <TestComponent onToastReady={(t) => (toastInstance = t)} />
          </div>
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId("two-trigger"));

      await waitFor(() => {
        expect(screen.getByText("Toast 1")).toBeInTheDocument();
        expect(screen.getByText("Toast 2")).toBeInTheDocument();
      });

      // Get dismiss buttons and click the first one
      const dismissButtons = screen.getAllByLabelText("Dismiss notification");
      fireEvent.click(dismissButtons[0]);

      // One should remain
      await waitFor(() => {
        expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
        expect(screen.getByText("Toast 2")).toBeInTheDocument();
      });
    });
  });

  describe("Toast accessibility", () => {
    it("renders toast container with aria-live and aria-label", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const container = screen.getByLabelText("Notifications");
      expect(container).toHaveAttribute("aria-live", "polite");
    });

    it("toast renders with role alert", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toBeInTheDocument();
      });
    });

    it("dismiss button has accessible label", async () => {
      let toastInstance: any;

      render(
        <ToastProvider>
          <TestComponent onToastReady={(t) => (toastInstance = t)} />
        </ToastProvider>
      );

      const button = screen.getByTestId("trigger-toast");
      fireEvent.click(button);

      await waitFor(() => {
        const dismissBtn = screen.getByLabelText("Dismiss notification");
        expect(dismissBtn).toBeInTheDocument();
      });
    });
  });
});
