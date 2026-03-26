import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SkillsSection from "@/components/dashboard/SkillsSection";
import type { Skill, MissingSkill } from "@/types/analysis";

const mockMatchedSkills: Skill[] = [
  { name: "Python", confidence: 0.95, category: "programming_language" },
  { name: "React", confidence: 0.85, category: "framework" },
  { name: "TypeScript", confidence: 0.9, category: "programming_language" },
];

const mockMissingSkills: MissingSkill[] = [
  { name: "Docker", priority: "high", category: "devops" },
  { name: "Kubernetes", priority: "medium", category: "devops" },
  { name: "GraphQL", priority: "low", category: "framework" },
];

describe("SkillsSection", () => {
  it("renders matched and missing skills headers", () => {
    render(<SkillsSection matchedSkills={mockMatchedSkills} missingSkills={mockMissingSkills} />);
    expect(screen.getByText("Matched Skills")).toBeInTheDocument();
    expect(screen.getByText("Missing Skills")).toBeInTheDocument();
  });

  it("shows skill counts", () => {
    render(<SkillsSection matchedSkills={mockMatchedSkills} missingSkills={mockMissingSkills} />);
    expect(screen.getByText("3 found")).toBeInTheDocument();
    expect(screen.getByText("3 gaps")).toBeInTheDocument();
  });

  it("renders skill names", () => {
    render(<SkillsSection matchedSkills={mockMatchedSkills} missingSkills={mockMissingSkills} />);
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
  });

  it("renders skill categories", () => {
    render(<SkillsSection matchedSkills={mockMatchedSkills} missingSkills={mockMissingSkills} />);
    expect(screen.getAllByText("programming_language")).toHaveLength(2);
  });

  it("shows empty state for no matched skills", () => {
    render(<SkillsSection matchedSkills={[]} missingSkills={mockMissingSkills} />);
    expect(screen.getByText("No matched skills found.")).toBeInTheDocument();
  });

  it("shows empty state for no missing skills", () => {
    render(<SkillsSection matchedSkills={mockMatchedSkills} missingSkills={[]} />);
    expect(screen.getByText("No skill gaps detected!")).toBeInTheDocument();
  });

  it("shows priority badges for missing skills", () => {
    render(<SkillsSection matchedSkills={[]} missingSkills={mockMissingSkills} />);
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("low")).toBeInTheDocument();
  });

  it("shows 'Show all' button when >8 items", () => {
    const manySkills: Skill[] = Array.from({ length: 10 }, (_, i) => ({
      name: `Skill ${i}`,
      confidence: 0.8,
      category: "general",
    }));
    render(<SkillsSection matchedSkills={manySkills} missingSkills={[]} />);
    expect(screen.getByText(/Show all 10/)).toBeInTheDocument();
  });

  it("toggles show all matched skills", () => {
    const manySkills: Skill[] = Array.from({ length: 10 }, (_, i) => ({
      name: `Skill${i}`,
      confidence: 0.8,
      category: "general",
    }));
    render(<SkillsSection matchedSkills={manySkills} missingSkills={[]} />);

    // Initially only 8 visible
    expect(screen.queryByText("Skill9")).not.toBeInTheDocument();

    // Click show all
    fireEvent.click(screen.getByText(/Show all 10/));
    expect(screen.getByText("Skill9")).toBeInTheDocument();

    // Click show less
    fireEvent.click(screen.getByText("Show less"));
    expect(screen.queryByText("Skill9")).not.toBeInTheDocument();
  });
});
