import React from "react";
import { render, screen } from "@testing-library/react";
import AnimatedList from "@/components/ui/AnimatedList";

interface TestItem {
  id: string;
  name: string;
}

const items: TestItem[] = [
  { id: "1", name: "First" },
  { id: "2", name: "Second" },
  { id: "3", name: "Third" },
];

describe("AnimatedList", () => {
  it("renders all items", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
      />
    );

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
      />
    );
    expect(screen.getByTestId("animated-list")).toBeInTheDocument();
  });

  it("assigns item-level testids", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
      />
    );

    expect(screen.getByTestId("animated-list-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("animated-list-item-2")).toBeInTheDocument();
    expect(screen.getByTestId("animated-list-item-3")).toBeInTheDocument();
  });

  it("renders with custom className", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        className="my-list"
      />
    );

    expect(screen.getByTestId("animated-list").className).toContain("my-list");
  });

  it("applies slide-out animation to removing items", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        removingIds={["2"]}
      />
    );

    const removingItem = screen.getByTestId("animated-list-item-2");
    expect(removingItem.className).toContain("animate-slide-out-right");
  });

  it("renders empty list", () => {
    render(
      <AnimatedList
        items={[]}
        keyExtractor={(item: TestItem) => item.id}
        renderItem={(item: TestItem) => <div>{item.name}</div>}
      />
    );

    expect(screen.getByTestId("animated-list")).toBeInTheDocument();
    expect(screen.queryByTestId(/animated-list-item/)).not.toBeInTheDocument();
  });

  it("passes index to renderItem", () => {
    render(
      <AnimatedList
        items={items}
        keyExtractor={(item) => item.id}
        renderItem={(item, index) => (
          <div>
            Item {index}: {item.name}
          </div>
        )}
      />
    );

    expect(screen.getByText("Item 0: First")).toBeInTheDocument();
    expect(screen.getByText("Item 1: Second")).toBeInTheDocument();
  });
});
