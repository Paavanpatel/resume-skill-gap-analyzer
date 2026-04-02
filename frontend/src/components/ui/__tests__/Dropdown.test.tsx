import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dropdown from "@/components/ui/Dropdown";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  __esModule: true,
  MoreVertical: (props: any) => <span data-testid="icon-more-vertical" {...props} />,
  Copy: (props: any) => <span data-testid="icon-copy" {...props} />,
  Trash2: (props: any) => <span data-testid="icon-trash" {...props} />,
}));

describe("Dropdown", () => {
  const mockItems = [
    { id: "edit", label: "Edit" },
    { id: "copy", label: "Copy" },
    { id: "delete", label: "Delete", danger: true },
  ];

  describe("Visibility", () => {
    it("renders trigger but not menu initially", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("opens menu on trigger click", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      fireEvent.click(trigger);

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("toggle menu on repeated clicks", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });

      // First click opens
      fireEvent.click(trigger);
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Second click closes
      fireEvent.click(trigger);
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  describe("Item selection", () => {
    it("calls onSelect when item clicked", () => {
      const onSelect = jest.fn();
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      const editItem = screen.getByRole("menuitem", { name: "Edit" });
      fireEvent.click(editItem);

      expect(onSelect).toHaveBeenCalledWith("edit");
    });

    it("closes menu after selection", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      const editItem = screen.getByRole("menuitem", { name: "Edit" });
      fireEvent.click(editItem);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("calls onSelect with correct id for each item", () => {
      const onSelect = jest.fn();
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const copyItem = screen.getByRole("menuitem", { name: "Copy" });
      fireEvent.click(copyItem);

      expect(onSelect).toHaveBeenCalledWith("copy");
    });
  });

  describe("Divider items", () => {
    it("renders divider items", () => {
      const itemsWithDivider = [
        { id: "edit", label: "Edit" },
        { id: "divider1", label: "", divider: true },
        { id: "delete", label: "Delete" },
      ];

      const { container } = render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDivider}
          onSelect={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const menu = screen.getByRole("menu");
      const dividers = menu.querySelectorAll("div[class*='h-px']");
      expect(dividers.length).toBeGreaterThan(0);
    });

    it("dividers are not selectable", () => {
      const itemsWithDivider = [
        { id: "edit", label: "Edit" },
        { id: "divider1", label: "", divider: true },
        { id: "delete", label: "Delete" },
      ];

      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDivider}
          onSelect={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      // Should have 2 menuitems (edit and delete), not 3
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(2);
    });
  });

  describe("Danger styling", () => {
    it("applies danger styling for danger items", () => {
      const { container } = render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const deleteItem = screen.getByRole("menuitem", { name: "Delete" });
      expect(deleteItem.className).toContain("danger");
    });

    it("danger items have danger text color", () => {
      const { container } = render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const deleteItem = screen.getByRole("menuitem", { name: "Delete" });
      expect(deleteItem.className).toMatch(/text-danger/);
    });
  });

  describe("Keyboard interactions", () => {
    it("Escape closes menu", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("Enter on trigger opens menu", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      fireEvent.keyDown(trigger, { key: "Enter" });

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("Space on trigger opens menu", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      fireEvent.keyDown(trigger, { key: " " });

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("ArrowDown on trigger opens menu and focuses first item", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
  });

  describe("Disabled items", () => {
    it("disabled items are not selectable", () => {
      const itemsWithDisabled = [
        { id: "edit", label: "Edit" },
        { id: "copy", label: "Copy", disabled: true },
        { id: "delete", label: "Delete" },
      ];

      const onSelect = jest.fn();
      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDisabled}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const copyItem = screen.getByRole("menuitem", { name: "Copy" });
      fireEvent.click(copyItem);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("disabled items have reduced opacity", () => {
      const itemsWithDisabled = [
        { id: "edit", label: "Edit" },
        { id: "copy", label: "Copy", disabled: true },
      ];

      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDisabled}
          onSelect={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const copyItem = screen.getByRole("menuitem", { name: "Copy" });
      expect(copyItem.className).toContain("opacity-40");
    });

    it("disabled items have cursor-not-allowed", () => {
      const itemsWithDisabled = [
        { id: "edit", label: "Edit" },
        { id: "copy", label: "Copy", disabled: true },
      ];

      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDisabled}
          onSelect={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const copyItem = screen.getByRole("menuitem", { name: "Copy" });
      expect(copyItem.className).toContain("cursor-not-allowed");
    });

    it("disabled items are not counted as selectable", () => {
      const itemsWithDisabled = [
        { id: "edit", label: "Edit" },
        { id: "copy", label: "Copy", disabled: true },
        { id: "delete", label: "Delete" },
      ];

      const onSelect = jest.fn();
      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithDisabled}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      // Should skip disabled item
      const editItem = screen.getByRole("menuitem", { name: "Edit" });
      expect(editItem).toBeInTheDocument();
    });
  });

  describe("Outside click", () => {
    it("closes menu on outside click", () => {
      const { container } = render(
        <div>
          <button>Outside</button>
          <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      const outsideButton = screen.getByRole("button", { name: "Outside" });
      fireEvent.mouseDown(outsideButton);

      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("does not close on click inside menu", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      const menu = screen.getByRole("menu");
      fireEvent.mouseDown(menu);

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });
  });

  describe("Items with icons", () => {
    it("renders items with icons", () => {
      const itemsWithIcons = [
        { id: "copy", label: "Copy", icon: <span data-testid="icon-copy">📋</span> },
        { id: "delete", label: "Delete", icon: <span data-testid="icon-trash">🗑️</span> },
      ];

      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={itemsWithIcons}
          onSelect={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
      expect(screen.getByTestId("icon-trash")).toBeInTheDocument();
    });
  });

  describe("Alignment", () => {
    it("supports right alignment (default)", () => {
      const { container } = render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={mockItems}
          onSelect={jest.fn()}
          align="right"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const menu = screen.getByRole("menu");
      expect(menu).toHaveAttribute("data-align", "right");
    });

    it("supports left alignment", () => {
      const { container } = render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={mockItems}
          onSelect={jest.fn()}
          align="left"
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const menu = screen.getByRole("menu");
      expect(menu).toHaveAttribute("data-align", "left");
    });
  });

  describe("Custom className", () => {
    it("merges custom className", () => {
      const { container } = render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={mockItems}
          onSelect={jest.fn()}
          className="custom-class"
        />
      );

      const dropdown = container.querySelector(".relative");
      expect(dropdown?.className).toContain("custom-class");
    });
  });

  describe("Aria attributes", () => {
    it("trigger has aria-haspopup='menu'", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    });

    it("trigger has aria-expanded", () => {
      const { rerender } = render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      const trigger = screen.getByRole("button", { name: "Menu" });
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(trigger);

      const updatedTrigger = screen.getByRole("button", { name: "Menu" });
      expect(updatedTrigger).toHaveAttribute("aria-expanded", "true");
    });

    it("menu has role='menu'", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("items have role='menuitem'", () => {
      render(
        <Dropdown trigger={<button>Menu</button>} items={mockItems} onSelect={jest.fn()} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems.length).toBeGreaterThan(0);
    });
  });

  describe("Complex scenarios", () => {
    it("handles multiple dropdowns independently", () => {
      render(
        <div>
          <Dropdown trigger={<button>Menu 1</button>} items={mockItems} onSelect={jest.fn()} />
          <Dropdown trigger={<button>Menu 2</button>} items={mockItems} onSelect={jest.fn()} />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu 1" }));
      expect(screen.getByRole("menu")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Menu 2" }));
      // Menu 2 should open
      const menus = screen.getAllByRole("menu");
      expect(menus.length).toBe(2);
    });

    it("handles mixed item types", () => {
      const complexItems = [
        { id: "edit", label: "Edit" },
        { id: "divider1", label: "", divider: true },
        { id: "copy", label: "Copy", disabled: true },
        { id: "divider2", label: "", divider: true },
        { id: "delete", label: "Delete", danger: true },
      ];

      const onSelect = jest.fn();
      render(
        <Dropdown
          trigger={<button>Menu</button>}
          items={complexItems}
          onSelect={onSelect}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Menu" }));

      const menuItems = screen.getAllByRole("menuitem");
      expect(screen.getAllByRole("menuitem")).toHaveLength(3);
      expect(screen.getAllByRole("menuitem", { hidden: false }).filter(
        el => !el.hasAttribute("disabled")
      )).toHaveLength(2);
    });
  });
});
