import React from "react";
import { render, screen } from "@testing-library/react";
import Skeleton, { ScoreCardSkeleton, ListItemSkeleton } from "@/components/ui/Skeleton";

describe("Skeleton", () => {
  describe("Default rect variant", () => {
    it("renders a rect skeleton by default", () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("rounded-lg");
    });

    it("applies custom className to rect variant", () => {
      const { container } = render(<Skeleton className="custom-class" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveClass("custom-class");
      expect(skeleton).toHaveClass("rounded-lg");
    });

    it("applies width and height styles to rect variant", () => {
      const { container } = render(<Skeleton width="200px" height="40px" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveStyle({ width: "200px", height: "40px" });
    });

    it("applies default height when only height is provided", () => {
      const { container } = render(<Skeleton variant="rect" height="50px" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveStyle({ height: "50px" });
    });

    it("uses default height (20px) when not specified", () => {
      const { container } = render(<Skeleton variant="rect" width="100px" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveStyle({ height: "20px" });
    });
  });

  describe("Circle variant", () => {
    it("renders circle variant", () => {
      const { container } = render(<Skeleton variant="circle" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("rounded-full");
    });

    it("applies custom className to circle variant", () => {
      const { container } = render(<Skeleton variant="circle" className="custom-circle" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveClass("custom-circle");
      expect(skeleton).toHaveClass("rounded-full");
    });

    it("uses default size (40px) for circle when width not provided", () => {
      const { container } = render(<Skeleton variant="circle" />);

      const skeleton = container.querySelector(".skeleton") as HTMLElement;
      expect(skeleton?.style.width).toBe("40px");
      expect(skeleton?.style.height).toBe("40px");
    });

    it("applies custom width and height to circle", () => {
      const { container } = render(<Skeleton variant="circle" width="80px" height="80px" />);

      const skeleton = container.querySelector(".skeleton") as HTMLElement;
      expect(skeleton?.style.width).toBe("80px");
      expect(skeleton?.style.height).toBe("80px");
    });

    it("uses width for height if height not provided", () => {
      const { container } = render(<Skeleton variant="circle" width="60px" />);

      const skeleton = container.querySelector(".skeleton") as HTMLElement;
      expect(skeleton?.style.width).toBe("60px");
      expect(skeleton?.style.height).toBe("60px");
    });
  });

  describe("Card variant", () => {
    it("renders card variant", () => {
      const { container } = render(<Skeleton variant="card" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass("rounded-xl");
    });

    it("applies fixed height and width for card", () => {
      const { container } = render(<Skeleton variant="card" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveClass("h-32");
      expect(skeleton).toHaveClass("w-full");
    });

    it("applies custom className to card variant", () => {
      const { container } = render(<Skeleton variant="card" className="custom-card" />);

      const skeleton = container.querySelector(".skeleton");
      expect(skeleton).toHaveClass("custom-card");
      expect(skeleton).toHaveClass("rounded-xl");
    });
  });

  describe("Text variant with multiple lines", () => {
    it("renders multiple text lines", () => {
      const { container } = render(<Skeleton variant="text" lines={3} />);

      const lines = container.querySelectorAll(".skeleton");
      expect(lines).toHaveLength(3);
    });

    it("renders single text line by default", () => {
      const { container } = render(<Skeleton variant="text" />);

      const lines = container.querySelectorAll(".skeleton");
      expect(lines).toHaveLength(1);
    });

    it("last text line is shorter (w-3/4)", () => {
      const { container } = render(<Skeleton variant="text" lines={3} />);

      const lines = container.querySelectorAll(".skeleton");
      const lastLine = lines[lines.length - 1];

      expect(lastLine).toHaveClass("w-3/4");
    });

    it("non-last lines are full width", () => {
      const { container } = render(<Skeleton variant="text" lines={3} />);

      const lines = container.querySelectorAll(".skeleton");

      // First two lines should be full width
      expect(lines[0]).toHaveClass("w-full");
      expect(lines[1]).toHaveClass("w-full");

      // Last line should be w-3/4
      expect(lines[2]).toHaveClass("w-3/4");
    });

    it("applies correct height to text lines", () => {
      const { container } = render(<Skeleton variant="text" lines={2} />);

      const lines = container.querySelectorAll(".skeleton");
      lines.forEach((line) => {
        expect(line).toHaveClass("h-4");
      });
    });

    it("applies spacing between lines", () => {
      const { container } = render(<Skeleton variant="text" lines={2} />);

      const wrapper = container.querySelector(".space-y-2");
      expect(wrapper).toBeInTheDocument();
    });

    it("applies custom className to text wrapper", () => {
      const { container } = render(<Skeleton variant="text" lines={2} className="custom-text" />);

      const wrapper = container.querySelector(".space-y-2");
      expect(wrapper).toHaveClass("custom-text");
    });

    it("applies custom width to text lines", () => {
      const { container } = render(<Skeleton variant="text" lines={2} width="150px" />);

      const lines = container.querySelectorAll(".skeleton");

      // First line should have custom width
      expect(lines[0]).toHaveStyle({ width: "150px" });
      // Last line uses w-3/4 instead of custom width
      expect(lines[1]).not.toHaveStyle({ width: "150px" });
    });

    it("applies custom height to text lines", () => {
      const { container } = render(<Skeleton variant="text" lines={2} height="16px" />);

      const lines = container.querySelectorAll(".skeleton");
      lines.forEach((line) => {
        expect(line).toHaveClass("h-4");
      });
    });
  });

  describe("ScoreCardSkeleton", () => {
    it("renders score card skeleton", () => {
      const { container } = render(<ScoreCardSkeleton />);

      const wrapper = container.querySelector(".rounded-xl");
      expect(wrapper).toBeInTheDocument();
    });

    it("renders circle skeleton for score icon", () => {
      const { container } = render(<ScoreCardSkeleton />);

      const lines = container.querySelectorAll(".skeleton");
      const circleSkeleton = lines[0];

      expect(circleSkeleton).toHaveClass("rounded-full");
      expect((circleSkeleton as HTMLElement)?.style.width).toBe("80px");
      expect((circleSkeleton as HTMLElement)?.style.height).toBe("80px");
    });

    it("renders text skeleton below circle", () => {
      const { container } = render(<ScoreCardSkeleton />);

      const lines = container.querySelectorAll(".skeleton");
      expect(lines.length).toBeGreaterThanOrEqual(2);

      const textSkeleton = lines[1];
      expect(textSkeleton).toHaveClass("rounded-lg");
    });

    it("has correct styling wrapper", () => {
      const { container } = render(<ScoreCardSkeleton />);

      const wrapper = container.querySelector(".rounded-xl");
      expect(wrapper).toHaveClass("border");
      expect(wrapper).toHaveClass("p-6");
      expect(wrapper).toHaveClass("flex");
      expect(wrapper).toHaveClass("flex-col");
      expect(wrapper).toHaveClass("items-center");
      expect(wrapper).toHaveClass("gap-3");
    });

    it("renders multiple elements in correct order", () => {
      const { container } = render(<ScoreCardSkeleton />);

      const skeletons = container.querySelectorAll(".skeleton");
      // Should have at least circle + text line
      expect(skeletons.length).toBeGreaterThanOrEqual(2);

      // First should be circle
      const firstSkeleton = skeletons[0];
      expect(firstSkeleton).toHaveClass("rounded-full");
    });
  });

  describe("ListItemSkeleton", () => {
    it("renders list item skeleton with default count", () => {
      const { container } = render(<ListItemSkeleton />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items).toHaveLength(3); // Default count is 3
    });

    it("renders correct number of items", () => {
      const { container } = render(<ListItemSkeleton count={5} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items).toHaveLength(5);
    });

    it("renders single item", () => {
      const { container } = render(<ListItemSkeleton count={1} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items).toHaveLength(1);
    });

    it("renders zero items when count is 0", () => {
      const { container } = render(<ListItemSkeleton count={0} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items).toHaveLength(0);
    });

    it("each item has circle skeleton", () => {
      const { container } = render(<ListItemSkeleton count={2} />);

      const circleSkeletons = container.querySelectorAll(".rounded-full");
      expect(circleSkeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("each item has text skeletons", () => {
      const { container } = render(<ListItemSkeleton count={2} />);

      // Each item should have 2 text lines
      const textWrappers = container.querySelectorAll(".space-y-1\\.5");
      expect(textWrappers.length).toBeGreaterThanOrEqual(2);
    });

    it("has correct spacing between list items", () => {
      const { container } = render(<ListItemSkeleton count={2} />);

      const wrapper = container.querySelector(".space-y-3");
      expect(wrapper).toBeInTheDocument();
    });

    it("each item has flex layout with gap", () => {
      const { container } = render(<ListItemSkeleton count={1} />);

      const item = container.querySelector(".flex.items-center");
      expect(item).toHaveClass("gap-3");
    });

    it("renders structured layout for each item", () => {
      const { container } = render(<ListItemSkeleton count={1} />);

      const item = container.querySelector(".flex.items-center");
      const children = item?.children;

      // Should have circle skeleton and content wrapper
      expect(children?.length).toBeGreaterThanOrEqual(2);

      // First child should be circle
      expect(children?.[0]).toHaveClass("rounded-full");

      // Second child should be flex-1 content wrapper
      const contentWrapper = children?.[1];
      expect(contentWrapper).toHaveClass("flex-1");
    });

    it("each item text wrapper has spacing", () => {
      const { container } = render(<ListItemSkeleton count={1} />);

      const textWrappers = container.querySelectorAll(".space-y-1\\.5");
      expect(textWrappers.length).toBeGreaterThanOrEqual(1);
    });

    it("renders multiple items with same structure", () => {
      const { container } = render(<ListItemSkeleton count={3} />);

      const items = container.querySelectorAll(".flex.items-center");
      items.forEach((item) => {
        expect(item).toHaveClass("gap-3");
        expect(item.querySelector(".rounded-full")).toBeInTheDocument();
        expect(item.querySelector(".flex-1")).toBeInTheDocument();
      });
    });
  });

  describe("Skeleton CSS classes", () => {
    it("all skeletons have skeleton base class", () => {
      const { container: rectContainer } = render(<Skeleton variant="rect" />);
      expect(rectContainer.querySelector(".skeleton")).toBeInTheDocument();

      const { container: circleContainer } = render(<Skeleton variant="circle" />);
      expect(circleContainer.querySelector(".skeleton")).toBeInTheDocument();

      const { container: cardContainer } = render(<Skeleton variant="card" />);
      expect(cardContainer.querySelector(".skeleton")).toBeInTheDocument();

      const { container: textContainer } = render(<Skeleton variant="text" />);
      expect(textContainer.querySelector(".skeleton")).toBeInTheDocument();
    });

    it("applies rounded classes correctly", () => {
      const variants: Array<["rect" | "circle" | "card" | "text", string]> = [
        ["rect", "rounded-lg"],
        ["circle", "rounded-full"],
        ["card", "rounded-xl"],
      ];

      variants.forEach(([variant, roundedClass]) => {
        const { container } = render(<Skeleton variant={variant as any} />);
        const skeleton = container.querySelector(".skeleton");
        expect(skeleton).toHaveClass(roundedClass);
      });
    });
  });
});
