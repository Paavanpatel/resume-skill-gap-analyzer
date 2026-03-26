import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs, { TabPanel } from "@/components/ui/Tabs";

describe("Tabs", () => {
  const mockTabs = [
    { id: "tab1", label: "Tab 1" },
    { id: "tab2", label: "Tab 2" },
    { id: "tab3", label: "Tab 3" },
  ];

  describe("Basic rendering", () => {
    it("renders all tab labels", () => {
      render(
        <Tabs tabs={mockTabs}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      expect(screen.getByText("Tab 1")).toBeInTheDocument();
      expect(screen.getByText("Tab 2")).toBeInTheDocument();
      expect(screen.getByText("Tab 3")).toBeInTheDocument();
    });

    it("first tab is active by default", () => {
      render(
        <Tabs tabs={mockTabs}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
          <TabPanel id="tab2" activeTab="tab1">
            Content 2
          </TabPanel>
        </Tabs>
      );

      const firstTab = screen.getByRole("tab", { name: "Tab 1" });
      expect(firstTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Tab interaction", () => {
    it("clicking a tab calls onTabChange", () => {
      const onTabChange = jest.fn();
      render(
        <Tabs tabs={mockTabs} onTabChange={onTabChange}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      fireEvent.click(tab2);

      expect(onTabChange).toHaveBeenCalledWith("tab2");
    });

    it("clicking a tab updates aria-selected", () => {
      const { rerender } = render(
        <Tabs tabs={mockTabs} activeTab="tab1">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      let tab1 = screen.getByRole("tab", { name: "Tab 1" });
      expect(tab1).toHaveAttribute("aria-selected", "true");

      rerender(
        <Tabs tabs={mockTabs} activeTab="tab2">
          <TabPanel id="tab1" activeTab="tab2">
            Content 1
          </TabPanel>
        </Tabs>
      );

      tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const tab2 = screen.getByRole("tab", { name: "Tab 2" });

      expect(tab1).toHaveAttribute("aria-selected", "false");
      expect(tab2).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("TabPanel rendering", () => {
    it("only active TabPanel is rendered", () => {
      render(
        <Tabs tabs={mockTabs} activeTab="tab2">
          <TabPanel id="tab1" activeTab="tab2">
            Content 1
          </TabPanel>
          <TabPanel id="tab2" activeTab="tab2">
            Content 2
          </TabPanel>
          <TabPanel id="tab3" activeTab="tab2">
            Content 3
          </TabPanel>
        </Tabs>
      );

      expect(screen.getByText("Content 2")).toBeInTheDocument();
      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.queryByText("Content 3")).not.toBeInTheDocument();
    });

    it("inactive TabPanel returns null", () => {
      const { container } = render(
        <TabPanel id="tab1" activeTab="tab2">
          Inactive Content
        </TabPanel>
      );

      // Panel should not be in the DOM
      expect(screen.queryByText("Inactive Content")).not.toBeInTheDocument();
    });

    it("switching tabs updates displayed content", () => {
      const { rerender } = render(
        <Tabs tabs={mockTabs} activeTab="tab1">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
          <TabPanel id="tab2" activeTab="tab1">
            Content 2
          </TabPanel>
        </Tabs>
      );

      expect(screen.getByText("Content 1")).toBeInTheDocument();
      expect(screen.queryByText("Content 2")).not.toBeInTheDocument();

      rerender(
        <Tabs tabs={mockTabs} activeTab="tab2">
          <TabPanel id="tab1" activeTab="tab2">
            Content 1
          </TabPanel>
          <TabPanel id="tab2" activeTab="tab2">
            Content 2
          </TabPanel>
        </Tabs>
      );

      expect(screen.queryByText("Content 1")).not.toBeInTheDocument();
      expect(screen.getByText("Content 2")).toBeInTheDocument();
    });
  });

  describe("Keyboard navigation", () => {
    it("arrow right key navigates to next tab", () => {
      const onTabChange = jest.fn();
      render(
        <Tabs tabs={mockTabs} activeTab="tab1" onTabChange={onTabChange}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      fireEvent.keyDown(tab1, { key: "ArrowRight" });

      expect(onTabChange).toHaveBeenCalledWith("tab2");
    });

    it("arrow left key navigates to previous tab", () => {
      const onTabChange = jest.fn();
      render(
        <Tabs tabs={mockTabs} activeTab="tab2" onTabChange={onTabChange}>
          <TabPanel id="tab2" activeTab="tab2">
            Content 2
          </TabPanel>
        </Tabs>
      );

      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      fireEvent.keyDown(tab2, { key: "ArrowLeft" });

      expect(onTabChange).toHaveBeenCalledWith("tab1");
    });

    it("arrow right wraps around to first tab", () => {
      const onTabChange = jest.fn();
      render(
        <Tabs tabs={mockTabs} activeTab="tab3" onTabChange={onTabChange}>
          <TabPanel id="tab3" activeTab="tab3">
            Content 3
          </TabPanel>
        </Tabs>
      );

      const tab3 = screen.getByRole("tab", { name: "Tab 3" });
      fireEvent.keyDown(tab3, { key: "ArrowRight" });

      expect(onTabChange).toHaveBeenCalledWith("tab1");
    });

    it("arrow left wraps around to last tab", () => {
      const onTabChange = jest.fn();
      render(
        <Tabs tabs={mockTabs} activeTab="tab1" onTabChange={onTabChange}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      fireEvent.keyDown(tab1, { key: "ArrowLeft" });

      expect(onTabChange).toHaveBeenCalledWith("tab3");
    });

    it("prevents default on arrow key navigation", () => {
      render(
        <Tabs tabs={mockTabs} activeTab="tab1">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tab1 = screen.getByRole("tab", { name: "Tab 1" });
      const event = new KeyboardEvent("keydown", { key: "ArrowRight" });
      const preventDefaultSpy = jest.spyOn(event, "preventDefault");

      fireEvent(tab1, event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("correct aria-selected attributes", () => {
      const { rerender } = render(
        <Tabs tabs={mockTabs} activeTab="tab1">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      let tab1 = screen.getByRole("tab", { name: "Tab 1" });
      let tab2 = screen.getByRole("tab", { name: "Tab 2" });
      let tab3 = screen.getByRole("tab", { name: "Tab 3" });

      expect(tab1).toHaveAttribute("aria-selected", "true");
      expect(tab2).toHaveAttribute("aria-selected", "false");
      expect(tab3).toHaveAttribute("aria-selected", "false");

      rerender(
        <Tabs tabs={mockTabs} activeTab="tab3">
          <TabPanel id="tab1" activeTab="tab3">
            Content 1
          </TabPanel>
        </Tabs>
      );

      tab1 = screen.getByRole("tab", { name: "Tab 1" });
      tab2 = screen.getByRole("tab", { name: "Tab 2" });
      tab3 = screen.getByRole("tab", { name: "Tab 3" });

      expect(tab1).toHaveAttribute("aria-selected", "false");
      expect(tab2).toHaveAttribute("aria-selected", "false");
      expect(tab3).toHaveAttribute("aria-selected", "true");
    });

    it("has role='tablist' on tab bar", () => {
      render(
        <Tabs tabs={mockTabs}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toBeInTheDocument();
    });

    it("has role='tab' on each tab", () => {
      render(
        <Tabs tabs={mockTabs}>
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(3);
    });

    it("has role='tabpanel' on active panel", () => {
      render(
        <Tabs tabs={mockTabs} activeTab="tab2">
          <TabPanel id="tab1" activeTab="tab2">
            Content 1
          </TabPanel>
          <TabPanel id="tab2" activeTab="tab2">
            Content 2
          </TabPanel>
        </Tabs>
      );

      const panel = screen.getByRole("tabpanel");
      expect(panel).toBeInTheDocument();
    });

    it("aria-controls connects tab to panel", () => {
      render(
        <Tabs tabs={mockTabs} activeTab="tab2">
          <TabPanel id="tab2" activeTab="tab2">
            Content 2
          </TabPanel>
        </Tabs>
      );

      const tab2 = screen.getByRole("tab", { name: "Tab 2" });
      expect(tab2).toHaveAttribute("aria-controls", "tabpanel-tab2");
    });
  });

  describe("Styling variants", () => {
    it("supports pill variant", () => {
      const { container } = render(
        <Tabs tabs={mockTabs} variant="pill">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist.className).toContain("rounded-xl");
      expect(tablist.className).toContain("bg-gray-100");
    });

    it("supports underline variant (default)", () => {
      const { container } = render(
        <Tabs tabs={mockTabs} variant="underline">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist.className).toContain("border-b");
    });

    it("supports size variants", () => {
      const { rerender } = render(
        <Tabs tabs={mockTabs} size="sm">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const tab = screen.getByRole("tab", { name: "Tab 1" });
      expect(tab.className).toContain("text-xs");

      rerender(
        <Tabs tabs={mockTabs} size="md">
          <TabPanel id="tab1" activeTab="tab1">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const updatedTab = screen.getByRole("tab", { name: "Tab 1" });
      expect(updatedTab.className).toContain("text-sm");
    });
  });

  describe("TabPanel with custom className", () => {
    it("applies custom className", () => {
      const { container } = render(
        <Tabs tabs={mockTabs} activeTab="tab1">
          <TabPanel id="tab1" activeTab="tab1" className="custom-class">
            Content 1
          </TabPanel>
        </Tabs>
      );

      const panel = screen.getByRole("tabpanel");
      expect(panel.className).toContain("custom-class");
    });
  });
});
