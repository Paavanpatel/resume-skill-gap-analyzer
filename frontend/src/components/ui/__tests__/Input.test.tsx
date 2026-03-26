import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Input from "@/components/ui/Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("generates id from label", () => {
    render(<Input label="Full Name" />);
    const input = screen.getByLabelText("Full Name");
    expect(input.id).toBe("full-name");
  });

  it("uses custom id when provided", () => {
    render(<Input label="Email" id="custom-id" />);
    const input = screen.getByLabelText("Email");
    expect(input.id).toBe("custom-id");
  });

  it("shows error message", () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("applies error styling when error is present", () => {
    render(<Input error="Error" />);
    const input = screen.getByRole("textbox");
    expect(input.className).toContain("border-danger-300");
  });

  it("handles value changes", () => {
    const onChange = jest.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("accepts placeholder", () => {
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
  });
});
