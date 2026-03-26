import React from "react";
import { render, screen, act } from "@testing-library/react";
import { LiveAnnouncerProvider, useLiveAnnouncer } from "@/components/ui/LiveAnnouncer";

// Helper component to trigger announcements
function AnnounceButton({ message, politeness }: { message: string; politeness?: "polite" | "assertive" }) {
  const { announce } = useLiveAnnouncer();
  return (
    <button onClick={() => announce(message, politeness)}>
      Announce
    </button>
  );
}

describe("LiveAnnouncerProvider", () => {
  it("renders children", () => {
    render(
      <LiveAnnouncerProvider>
        <p>Content</p>
      </LiveAnnouncerProvider>
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders live region with data-testid", () => {
    render(
      <LiveAnnouncerProvider>
        <p>Content</p>
      </LiveAnnouncerProvider>
    );
    expect(screen.getByTestId("live-announcer")).toBeInTheDocument();
  });

  it("has aria-live attribute set to polite by default", () => {
    render(
      <LiveAnnouncerProvider>
        <p>Content</p>
      </LiveAnnouncerProvider>
    );
    expect(screen.getByTestId("live-announcer")).toHaveAttribute("aria-live", "polite");
  });

  it("has role=status on the live region", () => {
    render(
      <LiveAnnouncerProvider>
        <p>Content</p>
      </LiveAnnouncerProvider>
    );
    expect(screen.getByTestId("live-announcer")).toHaveAttribute("role", "status");
  });

  it("has sr-only class for visual hiding", () => {
    render(
      <LiveAnnouncerProvider>
        <p>Content</p>
      </LiveAnnouncerProvider>
    );
    expect(screen.getByTestId("live-announcer").className).toContain("sr-only");
  });

  it("provides announce function via context", () => {
    render(
      <LiveAnnouncerProvider>
        <AnnounceButton message="Hello screen reader" />
      </LiveAnnouncerProvider>
    );

    // Should not throw
    act(() => {
      screen.getByText("Announce").click();
    });
  });
});
