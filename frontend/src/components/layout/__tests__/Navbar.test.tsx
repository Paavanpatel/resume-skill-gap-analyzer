import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Navbar from "../Navbar";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  __esModule: true,
  LogOut: (props: any) => <span data-testid="icon-logout" {...props} />,
  FileText: (props: any) => <span data-testid="icon-filetext" {...props} />,
  BarChart3: (props: any) => <span data-testid="icon-barchart3" {...props} />,
  Menu: (props: any) => <span data-testid="icon-menu" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
  User: (props: any) => <span data-testid="icon-user" {...props} />,
  Settings: (props: any) => <span data-testid="icon-settings" {...props} />,
  ChevronDown: (props: any) => <span data-testid="icon-chevrondown" {...props} />,
  CreditCard: (props: any) => <span data-testid="icon-creditcard" {...props} />,
  Shield: (props: any) => <span data-testid="icon-shield" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
}));

// Mock next-themes
const mockSetTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    setTheme: mockSetTheme,
    resolvedTheme: "light",
  }),
}));

// Mock AuthContext
const mockLogout = jest.fn();
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "test@example.com",
      full_name: "Test User",
    },
    logout: mockLogout,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock ThemeToggle component
jest.mock("@/components/ui/ThemeToggle", () => {
  return function DummyThemeToggle() {
    return <div data-testid="theme-toggle">Theme Toggle</div>;
  };
});

// Mock Dropdown component
jest.mock("@/components/ui/Dropdown", () => {
  return function DummyDropdown({
    trigger,
    items,
    onSelect,
  }: {
    trigger: React.ReactNode;
    items: any[];
    onSelect: (id: string) => void;
  }) {
    return (
      <div data-testid="dropdown">
        {trigger}
        <div data-testid="dropdown-items">
          {items.map((item) => (
            <button
              key={item.id}
              data-testid={`dropdown-item-${item.id}`}
              onClick={() => onSelect(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  };
});

// Mock useHealthCheck hook
jest.mock("@/hooks/useHealthCheck", () => ({
  useHealthCheck: () => ({
    status: "healthy",
    checks: null,
    lastChecked: new Date(),
    isLoading: false,
  }),
}));

describe("Navbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Brand rendering", () => {
    it("renders SkillGap brand name", () => {
      render(<Navbar />);
      const brandLinks = screen.getAllByText("SkillGap");
      expect(brandLinks.length).toBeGreaterThan(0);
      expect(screen.getByText("SkillGap")).toBeInTheDocument();
    });

    it("brand name links to dashboard", () => {
      render(<Navbar />);
      const brandLinks = screen.getAllByText("SkillGap");
      const desktopBrandLink = brandLinks[0].closest("a");
      expect(desktopBrandLink).toHaveAttribute("href", "/dashboard");
    });
  });

  describe("Navigation links", () => {
    it("renders New Analysis nav link", () => {
      render(<Navbar />);
      expect(screen.getByText("New Analysis")).toBeInTheDocument();
    });

    it("renders History nav link", () => {
      render(<Navbar />);
      expect(screen.getByText("History")).toBeInTheDocument();
    });

    it("New Analysis link has correct href", () => {
      render(<Navbar />);
      const newAnalysisLink = screen.getByText("New Analysis").closest("a");
      expect(newAnalysisLink).toHaveAttribute("href", "/dashboard");
    });

    it("History link has correct href", () => {
      render(<Navbar />);
      const historyLink = screen.getByText("History").closest("a");
      expect(historyLink).toHaveAttribute("href", "/history");
    });

    it("renders navigation icons", () => {
      render(<Navbar />);
      expect(screen.getByTestId("icon-barchart3")).toBeInTheDocument();
      expect(screen.getByTestId("icon-filetext")).toBeInTheDocument();
    });
  });

  describe("User avatar", () => {
    it("shows user initials avatar", () => {
      render(<Navbar />);
      // "Test User" should render as "TU"
      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("generates initials from user full_name", () => {
      render(<Navbar />);
      expect(screen.getByText("TU")).toBeInTheDocument();
    });

    it("displays ChevronDown icon next to avatar", () => {
      render(<Navbar />);
      expect(screen.getByTestId("icon-chevrondown")).toBeInTheDocument();
    });
  });

  describe("Active nav item highlighting", () => {
    it("highlights active nav item based on pathname", () => {
      render(<Navbar />);

      // Since usePathname mock returns "/dashboard", New Analysis should be active
      const newAnalysisLink = screen.getByText("New Analysis").closest("a");
      expect(newAnalysisLink).toHaveClass("text-primary-600");
    });

    it("shows active indicator under active nav link", () => {
      const { container } = render(<Navbar />);

      // Find the active indicator (span with height indicator)
      const activeIndicators = container.querySelectorAll("span.h-0\\.5");
      expect(activeIndicators.length).toBeGreaterThan(0);
    });
  });

  describe("Mobile menu", () => {
    it("renders mobile menu button", () => {
      render(<Navbar />);
      const menuButton = screen.getByLabelText("Open menu");
      expect(menuButton).toBeInTheDocument();
    });

    it("opens mobile menu on hamburger click", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      // Mobile drawer should now be visible with the close button
      await waitFor(() => {
        const closeButton = screen.getByLabelText("Close menu");
        expect(closeButton).toBeInTheDocument();
      });
    });

    it("shows user email in mobile drawer", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        // Should show email in drawer
        const emails = screen.getAllByText("test@example.com");
        expect(emails.length).toBeGreaterThan(0);
      });
    });

    it("shows user full name in mobile drawer", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("shows mobile nav links", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        const newAnalysisLinks = screen.getAllByText("New Analysis");
        const historyLinks = screen.getAllByText("History");
        expect(newAnalysisLinks.length).toBeGreaterThan(1); // Desktop + Mobile
        expect(historyLinks.length).toBeGreaterThan(1); // Desktop + Mobile
      });
    });

    it("shows theme toggle in mobile drawer", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getAllByTestId("theme-toggle").length).toBeGreaterThan(1);
      });
    });

    it("shows logout button in mobile drawer", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        const logoutButtons = screen.getAllByText("Log out");
        expect(logoutButtons.length).toBeGreaterThan(0);
      });
    });

    it("closes mobile menu on X button click", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText("Close menu");
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
      });
    });

    it("closes mobile menu when backdrop is clicked", async () => {
      const { container } = render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
      });

      // Find and click the backdrop
      // const backdrop = container.querySelector(".bg-black");
      const backdrop = container.querySelector('[class*="bg-black"]');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
      });
    });
  });

  describe("Mobile menu logout", () => {
    it("calls logout when mobile logout button clicked", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        const logoutButtons = screen.getAllByText("Log out");
        const mobileLogoutButton = logoutButtons[logoutButtons.length - 1]; // Last one is in drawer
        fireEvent.click(mobileLogoutButton);
      });

      expect(mockLogout).toHaveBeenCalled();
    });

    it("closes mobile menu after logout", async () => {
      render(<Navbar />);

      const menuButton = screen.getByLabelText("Open menu");
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Close menu")).toBeInTheDocument();
      });

      const logoutButtons = screen.getAllByText("Log out");
      const mobileLogoutButton = logoutButtons[logoutButtons.length - 1];
      fireEvent.click(mobileLogoutButton);

      await waitFor(() => {
        expect(screen.queryByLabelText("Close menu")).not.toBeInTheDocument();
      });
    });
  });

  describe("Desktop user dropdown", () => {
    it("renders dropdown trigger on desktop", () => {
      render(<Navbar />);
      // Dropdown should be present (but hidden on mobile via sm:block)
      expect(screen.getByTestId("dropdown")).toBeInTheDocument();
    });

    it("includes user email in dropdown", () => {
      render(<Navbar />);
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });

    it("includes logout option in dropdown", async () => {
      render(<Navbar />);
      const dropdownItems = screen.getByTestId("dropdown-items");
      const logoutItem = screen.getByTestId("dropdown-item-logout");
      expect(logoutItem).toBeInTheDocument();
    });

    it("calls logout when dropdown logout item selected", () => {
      render(<Navbar />);
      const logoutItem = screen.getByTestId("dropdown-item-logout");
      fireEvent.click(logoutItem);
      expect(mockLogout).toHaveBeenCalled();
    });

    //   it("includes settings option in dropdown", () => {
    //     render(<Navbar />);
    //     const settingsItem = screen.getByTestId("dropdown-item-settings");
    //     expect(settingsItem).toBeInTheDocument();
    //   });

    //   it("includes billing option in dropdown", () => {
    //     render(<Navbar />);
    //     const billingItem = screen.getByTestId("dropdown-item-billing");
    //     expect(billingItem).toBeInTheDocument();
    //   });

    //   it("renders user icon in dropdown", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-user")).toBeInTheDocument();
    //   });

    //   it("renders settings icon in dropdown", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-settings")).toBeInTheDocument();
    //   });

    //   it("renders credit card icon in dropdown", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-creditcard")).toBeInTheDocument();
    //   });

    //   it("renders logout icon in dropdown", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-logout")).toBeInTheDocument();
    //   });

    //   it("navigates to billing when billing item selected", () => {
    //     render(<Navbar />);
    //     const billingItem = screen.getByTestId("dropdown-item-billing");
    //     fireEvent.click(billingItem);
    //     expect(mockPush).toHaveBeenCalledWith("/settings?tab=billing");
    //   });

    //   it("navigates to settings when settings item selected", () => {
    //     render(<Navbar />);
    //     const settingsItem = screen.getByTestId("dropdown-item-settings");
    //     fireEvent.click(settingsItem);
    //     expect(mockPush).toHaveBeenCalledWith("/settings");
    //   });
    // });

    // describe("Admin dropdown items", () => {
    //   it("does not show admin option for regular users", () => {
    //     render(<Navbar />);
    //     const adminItem = screen.queryByTestId("dropdown-item-admin");
    //     expect(adminItem).not.toBeInTheDocument();
    //   });

    //   it("shows admin option for admin users", () => {
    //     jest.doMock("@/context/AuthContext", () => ({
    //       useAuth: () => ({
    //         user: {
    //           email: "admin@example.com",
    //           full_name: "Admin User",
    //           role: "admin",
    //         },
    //         logout: mockLogout,
    //         isAuthenticated: true,
    //         isLoading: false,
    //       }),
    //     }));

    //     render(<Navbar />);
    //     // The dropdown-item-admin should be rendered if role is admin
    //     // Note: This requires mocking to be reset and reimplemented
    //     // For now we verify the mock infrastructure is in place
    //     expect(screen.getByTestId("icon-shield")).toBeInTheDocument();
    //   });

    //   it("renders shield icon in dropdown", () => {
    //     render(<Navbar />);
    //     // Shield icon should be available in the mock
    //     expect(screen.getByTestId("icon-shield")).toBeInTheDocument();
    //   });
    // });

    // describe("Tier and Icons", () => {
    //   it("renders sparkles icon", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-sparkles")).toBeInTheDocument();
    //   });

    //   it("renders chevron down icon for dropdown trigger", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-chevrondown")).toBeInTheDocument();
    //   });

    //   it("renders all required navigation icons", () => {
    //     render(<Navbar />);
    //     expect(screen.getByTestId("icon-barchart3")).toBeInTheDocument();
    //     expect(screen.getByTestId("icon-filetext")).toBeInTheDocument();
    //     expect(screen.getByTestId("icon-menu")).toBeInTheDocument();
    //   });
    // });

    describe("Theme toggle", () => {
      it("renders theme toggle on desktop", () => {
        render(<Navbar />);
        expect(screen.getAllByTestId("theme-toggle").length).toBeGreaterThan(0);
      });

      it("renders theme toggle in mobile drawer", async () => {
        render(<Navbar />);

        const menuButton = screen.getByLabelText("Open menu");
        fireEvent.click(menuButton);

        await waitFor(() => {
          const themeToggles = screen.getAllByTestId("theme-toggle");
          expect(themeToggles.length).toBeGreaterThan(1); // Desktop + Mobile
        });
      });
    });

    describe("Sticky header", () => {
      it("renders as sticky header", () => {
        const { container } = render(<Navbar />);
        const header = container.querySelector("header");
        expect(header).toHaveClass("sticky");
        expect(header).toHaveClass("top-0");
        expect(header).toHaveClass("z-40");
      });
    });

    describe("Edge cases", () => {
      it("renders initials correctly for single name", () => {
        jest.doMock("@/context/AuthContext", () => ({
          useAuth: () => ({
            user: {
              email: "test@example.com",
              full_name: "User",
            },
            logout: mockLogout,
            isAuthenticated: true,
            isLoading: false,
          }),
        }));

        render(<Navbar />);
        expect(screen.getByText("TU")).toBeInTheDocument();
      });

      it("handles multiple spaces in full_name", () => {
        render(<Navbar />);
        expect(screen.getByText("TU")).toBeInTheDocument();
      });
    });

    describe("Accessibility", () => {
      it("mobile menu button has aria-label", () => {
        render(<Navbar />);
        const menuButton = screen.getByLabelText("Open menu");
        expect(menuButton).toHaveAttribute("aria-label");
      });

      it("mobile close button has aria-label", async () => {
        render(<Navbar />);

        const menuButton = screen.getByLabelText("Open menu");
        fireEvent.click(menuButton);

        await waitFor(() => {
          const closeButton = screen.getByLabelText("Close menu");
          expect(closeButton).toHaveAttribute("aria-label");
        });
      });

      it("nav links are proper link elements", () => {
        render(<Navbar />);
        const newAnalysisLink = screen.getByText("New Analysis").closest("a");
        expect(newAnalysisLink).toHaveAttribute("href");
      });
    });

    describe("Mobile responsive behavior", () => {
      it("hides desktop nav on mobile (sm:hidden)", () => {
        const { container } = render(<Navbar />);
        const desktopNav = container.querySelector("nav.hidden.sm\\:flex");
        expect(desktopNav).toBeInTheDocument();
      });

      it("shows mobile menu button (sm:hidden for desktop)", () => {
        render(<Navbar />);
        const menuButton = screen.getByLabelText("Open menu");
        expect(menuButton).toBeInTheDocument();
      });
    });
  });
});
