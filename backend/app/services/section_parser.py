"""
Resume section parser.

Takes raw extracted text and identifies common resume sections like
Experience, Education, Skills, Projects, Certifications, etc.

The approach: scan line by line for heading patterns that match known
section labels. When a heading is found, everything below it (until the
next heading) becomes that section's content.

Why regex-based heading detection instead of an LLM?
- Speed: this runs in <10ms vs seconds for an API call.
- Cost: zero API cost per parse.
- Determinism: same input always produces same output.
- The LLM comes in Phase 5 for skill extraction, which actually needs
  intelligence. Section detection is pattern matching, not reasoning.

Limitation: highly creative resume formats (infographics, non-standard
headings like "Where I've Made an Impact") may not parse perfectly.
The fallback is a single "content" section containing everything.
"""

import re
from dataclasses import dataclass, field

# Heading patterns grouped by canonical section name.
# Each list contains variations that people actually write on resumes.
# Order matters: we check top-down and assign to the first match.
SECTION_PATTERNS: dict[str, list[str]] = {
    "contact": [
        r"contact\s*(?:info(?:rmation)?)?",
        r"personal\s*(?:info(?:rmation)?|details)?",
    ],
    "summary": [
        r"(?:professional\s*)?summary",
        r"(?:career\s*)?objective",
        r"profile",
        r"about\s*me",
    ],
    "experience": [
        r"(?:work|professional|employment)\s*(?:experience|history)",
        r"experience",
        r"work\s*history",
    ],
    "education": [
        r"education(?:al\s*background)?",
        r"academic\s*(?:background|qualifications)",
        r"degrees?\s*(?:&|and)?\s*certifications?",
    ],
    "skills": [
        r"(?:technical\s*|core\s*|key\s*)?skills",
        r"(?:technical\s*|core\s*|key\s*)?competencies",
        r"technologies",
        r"tech\s*stack",
        r"tools?\s*(?:&|and)?\s*technologies",
    ],
    "projects": [
        r"(?:key\s*|notable\s*|personal\s*)?projects",
        r"portfolio",
    ],
    "certifications": [
        r"certifications?\s*(?:&|and)?\s*licenses?",
        r"certifications?",
        r"licenses?\s*(?:&|and)?\s*certifications?",
        r"professional\s*certifications?",
    ],
    "awards": [
        r"awards?\s*(?:&|and)?\s*(?:honors?|achievements?)",
        r"honors?\s*(?:&|and)?\s*awards?",
        r"achievements?",
    ],
    "publications": [
        r"publications?",
        r"research(?:\s*papers?)?",
    ],
    "volunteer": [
        r"volunteer(?:ing)?\s*(?:experience|work)?",
        r"community\s*(?:service|involvement)",
    ],
    "languages": [
        r"languages?",
    ],
    "interests": [
        r"interests?",
        r"hobbies?\s*(?:&|and)?\s*interests?",
    ],
    "references": [
        r"references?",
    ],
}

# Precompile a single pattern that matches any section heading.
# A line is considered a heading if it:
#   - Starts at the beginning of the line (or after whitespace)
#   - Matches a known section pattern
#   - Is relatively short (headings aren't paragraphs)
#   - May end with a colon
_heading_regexes: list[tuple[str, re.Pattern]] = []
for section_name, patterns in SECTION_PATTERNS.items():
    for pattern in patterns:
        compiled = re.compile(
            rf"^\s*{pattern}\s*:?\s*$",
            re.IGNORECASE,
        )
        _heading_regexes.append((section_name, compiled))


@dataclass
class ParsedSection:
    """A single identified section of the resume."""
    name: str
    content: str
    line_start: int
    line_end: int


@dataclass
class ParsedResume:
    """Complete parsed resume with identified sections."""
    sections: list[ParsedSection] = field(default_factory=list)
    raw_text: str = ""
    word_count: int = 0

    def to_dict(self) -> dict:
        """Serialize for JSON storage in the database."""
        return {
            "sections": [
                {
                    "name": s.name,
                    "content": s.content,
                    "line_start": s.line_start,
                    "line_end": s.line_end,
                }
                for s in self.sections
            ],
            "word_count": self.word_count,
        }

    def get_section(self, name: str) -> str | None:
        """Get the content of a named section, or None if not found."""
        for section in self.sections:
            if section.name == name:
                return section.content
        return None


def _detect_heading(line: str) -> str | None:
    """Check if a line matches any known section heading. Returns the canonical name."""
    stripped = line.strip()
    # Headings are typically short. Skip anything longer than 60 chars.
    if len(stripped) > 60:
        return None
    for section_name, regex in _heading_regexes:
        if regex.match(stripped):
            return section_name
    return None


def parse_sections(raw_text: str) -> ParsedResume:
    """
    Parse raw resume text into labeled sections.

    Lines are scanned sequentially. When a heading is detected, a new
    section begins. Lines before the first heading are captured as
    a "header" section (typically the candidate's name and contact info).

    Args:
        raw_text: The full text extracted from the resume file.

    Returns:
        A ParsedResume with identified sections and metadata.
    """
    lines = raw_text.split("\n")
    word_count = len(raw_text.split())

    # Track section boundaries as (name, start_line_index)
    boundaries: list[tuple[str, int]] = []
    current_section = "header"  # Everything before the first real heading
    section_start = 0

    for i, line in enumerate(lines):
        heading = _detect_heading(line)
        if heading is not None:
            # Close the previous section
            boundaries.append((current_section, section_start))
            current_section = heading
            section_start = i + 1  # Content starts on the line after the heading

    # Close the last section
    boundaries.append((current_section, section_start))

    # Build ParsedSection objects from the boundaries
    sections: list[ParsedSection] = []
    for idx, (name, start) in enumerate(boundaries):
        # End of this section is the start of the next, or end of file
        if idx + 1 < len(boundaries):
            end = boundaries[idx + 1][1] - 1  # -1 to exclude the next heading line
        else:
            end = len(lines)

        content = "\n".join(lines[start:end]).strip()
        if content:  # Skip empty sections
            sections.append(ParsedSection(
                name=name,
                content=content,
                line_start=start,
                line_end=end,
            ))

    return ParsedResume(
        sections=sections,
        raw_text=raw_text,
        word_count=word_count,
    )
