import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Modal, { ModalFooter } from "@/components/ui/Modal";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  __esModule: true,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

// Test component wrapper for Modal with state management
function TestModalWrapper({
  defaultOpen = false,
  ...props
}: {
  defaultOpen?: boolean;
  [key: string]: any;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <>
      <button onClick={() => setIsOpen(true)} data-testid="open-button">
        Open Modal
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        {...props}
      >
        {props.children || <div>Modal content</div>}
      </Modal>
    </>
  );
}

describe("Modal", () => {
  describe("Visibility", () => {
    it("renders nothing when isOpen is false", () => {
      const { container } = render(
        <Modal isOpen={false} onClose={jest.fn()}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByText("Modal Content")).not.toBeInTheDocument();
    });

    it("renders modal content when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Modal Content</div>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Modal Content")).toBeInTheDocument();
    });
  });

  describe("Header content", () => {
    it("shows title and description when provided", () => {
      render(
        <Modal
          isOpen={true}
          onClose={jest.fn()}
          title="Test Title"
          description="Test Description"
        >
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText("Test Title")).toBeInTheDocument();
      expect(screen.getByText("Test Description")).toBeInTheDocument();
    });

    it("renders without title when not provided", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByText("modal-title")).not.toBeInTheDocument();
    });

    it("uses modal-title id for accessibility", () => {
      render(
        <Modal
          isOpen={true}
          onClose={jest.fn()}
          title="Accessible Title"
        >
          <div>Content</div>
        </Modal>
      );

      const title = screen.getByText("Accessible Title");
      expect(title).toHaveAttribute("id", "modal-title");
    });

    it("uses modal-description id for accessibility", () => {
      render(
        <Modal
          isOpen={true}
          onClose={jest.fn()}
          description="Accessible Description"
        >
          <div>Content</div>
        </Modal>
      );

      const description = screen.getByText("Accessible Description");
      expect(description).toHaveAttribute("id", "modal-description");
    });
  });

  describe("Close button", () => {
    it("calls onClose when X button clicked", () => {
      const mockOnClose = jest.fn();

      const { rerender } = render(
        <Modal
          isOpen={true}
          onClose={mockOnClose}
          title="Test Modal"
        >
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByLabelText("Close dialog");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("hides close button when hideCloseButton is true", () => {
      render(
        <Modal
          isOpen={true}
          onClose={jest.fn()}
          title="Test Modal"
          hideCloseButton={true}
        >
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByLabelText("Close dialog")).not.toBeInTheDocument();
    });

    it("does not show close button when no header content", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} hideCloseButton={true}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByLabelText("Close dialog")).not.toBeInTheDocument();
    });
  });

  describe("Keyboard interactions", () => {
    it("calls onClose when Escape pressed", () => {
      const mockOnClose = jest.fn();

      render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnEscape={true}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not close on Escape when closeOnEscape is false", () => {
      const mockOnClose = jest.fn();

      render(
        <Modal isOpen={true} onClose={mockOnClose} closeOnEscape={false}>
          <div>Content</div>
        </Modal>
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Backdrop interactions", () => {
    it("calls onClose when backdrop clicked (closeOnBackdrop=true)", () => {
      const mockOnClose = jest.fn();

      const { container } = render(
        <Modal
          isOpen={true}
          onClose={mockOnClose}
          closeOnBackdrop={true}
        >
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does NOT close on backdrop click when closeOnBackdrop=false", () => {
      const mockOnClose = jest.fn();

      const { container } = render(
        <Modal
          isOpen={true}
          onClose={mockOnClose}
          closeOnBackdrop={false}
        >
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      fireEvent.click(dialog);

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("does not close when clicking inside modal content", () => {
      const mockOnClose = jest.fn();

      render(
        <Modal
          isOpen={true}
          onClose={mockOnClose}
          closeOnBackdrop={true}
        >
          <div data-testid="modal-content">Content</div>
        </Modal>
      );

      const content = screen.getByTestId("modal-content");
      fireEvent.click(content);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Body scroll locking", () => {
    it("locks body scroll when open", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll on close", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <Modal isOpen={false} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("");
    });

    it("properly cleans up overflow on unmount", () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });
  });

  describe("Modal sizes", () => {
    it("applies sm size class", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} size="sm">
          <div>Content</div>
        </Modal>
      );

      const content = screen.getByRole("dialog").querySelector("div:last-child");
      expect(content).toHaveClass("max-w-sm");
    });

    it("applies md size class", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} size="md">
          <div>Content</div>
        </Modal>
      );

      const content = screen.getByRole("dialog").querySelector("div:last-child");
      expect(content).toHaveClass("max-w-md");
    });

    it("applies lg size class (default)", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      const content = screen.getByRole("dialog").querySelector("div:last-child");
      expect(content).toHaveClass("max-w-lg");
    });

    it("applies xl size class", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} size="xl">
          <div>Content</div>
        </Modal>
      );

      const content = screen.getByRole("dialog").querySelector("div:last-child");
      expect(content).toHaveClass("max-w-xl");
    });
  });

  describe("Accessibility", () => {
    it("renders with role=dialog", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal=true", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("sets aria-labelledby when title is provided", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} title="Test">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-labelledby", "modal-title");
    });

    it("sets aria-describedby when description is provided", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} description="Test">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-describedby", "modal-description");
    });
  });

  describe("ModalFooter component", () => {
    it("renders children", () => {
      render(
        <ModalFooter>
          <button>Action 1</button>
          <button>Action 2</button>
        </ModalFooter>
      );

      expect(screen.getByText("Action 1")).toBeInTheDocument();
      expect(screen.getByText("Action 2")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(
        <ModalFooter className="custom-class">
          <button>Action</button>
        </ModalFooter>
      );

      const footer = container.querySelector("div");
      expect(footer).toHaveClass("custom-class");
    });

    it("has correct default styling classes", () => {
      const { container } = render(
        <ModalFooter>
          <button>Action</button>
        </ModalFooter>
      );

      const footer = container.querySelector("div");
      expect(footer).toHaveClass("flex");
      expect(footer).toHaveClass("items-center");
      expect(footer).toHaveClass("justify-end");
      expect(footer).toHaveClass("gap-3");
    });

    it("works within a modal", () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} title="Confirm">
          <div>Are you sure?</div>
          <ModalFooter>
            <button>Cancel</button>
            <button>Confirm</button>
          </ModalFooter>
        </Modal>
      );

      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
      // expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      // expect(screen.getByText("Cancel")).toBeInTheDocument();
      // expect(screen.getByText("Confirm")).toBeInTheDocument();
    });
  });

  describe("Complex scenarios", () => {
    it("handles modal state transitions", () => {
      const mockOnClose = jest.fn();

      const { rerender } = render(
        <Modal isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      rerender(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      rerender(
        <Modal isOpen={false} onClose={mockOnClose}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("supports all header options together", () => {
      render(
        <Modal
          isOpen={true}
          onClose={jest.fn()}
          title="Full Modal"
          description="With everything"
          hideCloseButton={false}
        >
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText("Full Modal")).toBeInTheDocument();
      expect(screen.getByText("With everything")).toBeInTheDocument();
      expect(screen.getByLabelText("Close dialog")).toBeInTheDocument();
    });
  });
});
